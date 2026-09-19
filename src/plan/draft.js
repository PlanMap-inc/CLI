import fs from "node:fs";
import path from "node:path";

import {
    readPlan,
    writePlan
} from "./storage.js";

import {
    validatePlan
} from "./model.js";

import {
    clauseProblem,
    NUMERIC_FACT_FIELDS
} from "./evaluate.js";

import {
    readBaseline
} from "../changes/check.js";

import {
    readEvolution
} from "../evolution/storage.js";

import {
    loadSessions
} from "../watching/sessions.js";

import {
    getEvolutionFacts
} from "../evolution/classification.js";

import {
    getEvolutionVocabulary,
    getEvolutionStages
} from "../evolution/classification.js";

import {
    isLocalLlm,
    loadLlmApiKey,
    ollamaChatEndpoint,
    LLM_MODEL,
    LLM_ENDPOINT,
    LLM_NUM_CTX
} from "../llm/config.js";

import {
    extractOpenRouterText,
    parseOpenRouterJson
} from "../llm/response.js";

import {
    LENSES,
    LENS_IDS,
    canonicalLenses,
    lensCatalogue
} from "../llm/lenses.js";


// --------------------------------------------------
// PLAN DRAFT HELPERS
// --------------------------------------------------
// 1-Builds deterministic plan identifiers.
// 2-Keeps generated identifiers stable within one draft.
// 3-Provides small helpers shared by both draft modes.
// --------------------------------------------------

function createId(
    prefix,
    number
) {
    return (
        `${prefix}_${String(
            number
        ).padStart(
            4,
            "0"
        )}`
    );
}


function getNextNodeNumber(
    plan
) {
    let maximum =
        0;

    for (
        const node of plan.nodes || []
    ) {
        const match =
            /^plan_(\d+)$/.exec(
                node?.id || ""
            );

        if (
            match
        ) {
            maximum =
                Math.max(
                    maximum,
                    Number(
                        match[1]
                    )
                );
        }
    }

    return maximum + 1;
}


function getNextFeatureNumber(
    plan
) {
    let maximum =
        0;

    for (
        const feature of plan.features || []
    ) {
        const match =
            /^feat_(\d+)$/.exec(
                feature?.id || ""
            );

        if (
            match
        ) {
            maximum =
                Math.max(
                    maximum,
                    Number(
                        match[1]
                    )
                );
        }
    }

    return maximum + 1;
}


function getNextLensNumber(
    plan
) {
    let maximum =
        0;

    for (
        const lens of plan.lenses || []
    ) {
        const match =
            /^lens_(\d+)$/.exec(
                lens?.id || ""
            );

        if (
            match
        ) {
            maximum =
                Math.max(
                    maximum,
                    Number(
                        match[1]
                    )
                );
        }
    }

    return maximum + 1;
}


// --------------------------------------------------
// LOAD OPENROUTER
// --------------------------------------------------
// 1-Loads the existing project API configuration.
// 2-Throws before any plan mutation when no key exists.
// 3-Keeps the no-key path atomic.
// --------------------------------------------------

function requireOpenRouterApiKey() {
    const apiKey =
        loadLlmApiKey();

    // A local server needs no key; a hosted one does.
    if (
        !apiKey &&
        !isLocalLlm()
    ) {
        throw new Error(
            "OPENROUTER_API_KEY is not configured."
        );
    }

    return apiKey || "local";
}


// --------------------------------------------------
// CALL OPENROUTER
// --------------------------------------------------
// 1-Sends one drafting request.
// 2-Reuses the existing OpenRouter response helpers.
// 3-Rejects malformed model output.
// --------------------------------------------------

async function callOpenRouter(
    prompt
) {
    const apiKey =
        requireOpenRouterApiKey();

    // Ollama's own API accepts the context size per request; the
    // OpenAI-compatible one does not.
    const ollamaEndpoint =
        ollamaChatEndpoint();

    const requestBody =
        ollamaEndpoint
            ? {
                model:
                    LLM_MODEL,

                messages: [
                    {
                        role:
                            "user",

                        content:
                            prompt
                    }
                ],

                stream:
                    false,

                options: {
                    temperature:
                        0.1,

                    num_ctx:
                        LLM_NUM_CTX,

                    num_predict:
                        16000
                }
            }
            : null;

    let response;

    try {
        response =
            await fetch(
                ollamaEndpoint || LLM_ENDPOINT,
                {
                    method:
                        "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${apiKey}`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        requestBody
                            ? JSON.stringify(requestBody)
                            : JSON.stringify({
                            model:
                                LLM_MODEL,

                            messages: [
                                {
                                    role:
                                        "user",

                                    content:
                                        prompt
                                }
                            ],

                            temperature:
                                0.1,

                            // Reasoning models count their hidden reasoning
                            // against max_tokens. At 4000 the plan JSON was cut
                            // off or empty; a 7-node draft used ~3100-11500
                            // tokens across the free models tried.
                            max_tokens:
                                16000
                        })
                }
        );
    } catch (error) {
        throw new Error(
            `Cannot reach the model at ${LLM_ENDPOINT}: ${error.message}. Start it (ollama serve), or set PLANMAP_LLM_ENDPOINT.`
        );
    }

    if (
        !response.ok
    ) {
        const errorText =
            await response.text();

        throw new Error(
            `OpenRouter request failed (${response.status}): ${errorText}`
        );
    }

    const data =
        await response.json();

    const text =
        extractOpenRouterText(
            data
        );

    return parseOpenRouterJson(
        text
    );
}


// --------------------------------------------------
// BROWNFIELD CANDIDATES
// --------------------------------------------------
// 1-Reads sealed sessions.
// 2-Uses significant declarations only.
// 3-Deduplicates identities across sessions.
// 4-Does not draft insignificant declarations.
// --------------------------------------------------

function collectBrownfieldCandidates(
    projectRoot
) {
    const evolution =
        readEvolution(
            projectRoot
        );

    const sessions =
        loadSessions(
            projectRoot
        );

    const candidates =
        new Map();

    // --------------------------------------------------
    // 1-Genesis evolution nodes are significant.
    // 2-Later session significance supplies changed/deleted
    //   declarations.
    // 3-Deduplicates identities across both sources.
    // --------------------------------------------------

    for (
        const node of evolution?.nodes || []
    ) {
        if (
            !node?.identity
        ) {
            continue;
        }

        if (
            node.type !== "added" &&
            node.type !== "deleted"
        ) {
            continue;
        }

        if (
            !candidates.has(
                node.identity
            )
        ) {
            candidates.set(
                node.identity,
                {
                    identity:
                        node.identity,

                    type:
                        node.type
                }
            );
        }
    }

    for (
        const session of sessions
    ) {
        const declarations =
            session?.significance?.declarations ||
            [];

        for (
            const declaration of declarations
        ) {
            if (
                !declaration?.identity
            ) {
                continue;
            }

            if (
                !candidates.has(
                    declaration.identity
                )
            ) {
                candidates.set(
                    declaration.identity,
                    {
                        identity:
                            declaration.identity,

                        type:
                            declaration.type ||
                            "changed"
                    }
                );
            }
        }
    }

    return Array.from(
        candidates.values()
    );
}


// --------------------------------------------------
// BUILD BROWNFIELD PROMPT
// --------------------------------------------------
// 1-Provides only significant declarations.
// 2-Provides known PlanMap facts.
// 3-Requires behaviour rules.
// 4-Forbids unsupported facts.
// --------------------------------------------------

function buildBrownfieldPrompt(
    candidates,
    factsByIdentity,
    vocabulary,
    groupByIdentity = {}
) {
    const declarations =
        candidates.map(
            candidate => ({
                identity:
                    candidate.identity,

                type:
                    candidate.type,

                // What the Evolution graph already decided this declaration
                // is part of, so the plan tells the same story the outline
                // does instead of regrouping the same code differently.
                partOf:
                    groupByIdentity[
                        candidate.identity
                    ] || null,

                facts:
                    factsByIdentity[
                        candidate.identity
                    ] || {}
            })
        );

    return `
You are drafting a PlanMap v0.6 brownfield development plan.

Return ONLY valid JSON.

The project already exists. Draft intent for the significant declarations supplied below.

Every returned node MUST contain:
- identity
- feature
- step
- title
- intent
- lensTags
- readings
- rules


--------------------------------------------------
TITLE AND INTENT QUALITY
--------------------------------------------------

A plan reads as the product's own story, in the order a user lives it.

title = the step, named as the product behaves.
Keep it under 7 words. No function names. No file names.

NEVER start a title with: Ensure, Handle, Manage, Process, Validate that,
Verify that, Implement, Support.

WRONG:
Ensure submitSurvey function handles errors and responds appropriately
Ensure JWT verification middleware correctly handles authentication
Handle user credential response

RIGHT:
Sign in with Google
Issue a 24-hour session token
Refuse a second submission
Save all seven answers together

intent = ONE sentence saying what must stay true, in plain language,
supported by the supplied facts. Not a restatement of the title, and not a
description of the code's shape.

WRONG:
The submitSurvey function should handle errors, log them, and respond with
appropriate status codes.

RIGHT:
A submission is rejected unless all seven answers are present.


--------------------------------------------------
FEATURES AND ORDER
--------------------------------------------------

feature = the user-facing capability this step belongs to, chosen from the
supplied features.

Each declaration carries "partOf": the feature and group the Evolution
graph already placed it in. Use that feature unless the supplied facts
plainly contradict it. The two views describe the same code and must not
disagree about where it belongs.

Spread the declarations across the features they truly belong to. Putting
most of them in one feature is wrong: a feature holding almost everything
tells a reader nothing.

step = this step's position inside its feature, counting from 1, in the
order a user reaches it. Steps within one feature must be numbered 1, 2, 3
with no gaps and no repeats.

Order by what happens, in sequence, not by which file it lives in:

1. What the person does first - the screen, the button, the form.
2. What is sent, and what receives it - the route or endpoint.
3. What must be true before it proceeds - the checks.
4. What is stored or returned.
5. What the person sees as a result.

A feature's steps therefore cross the frontend and the backend, and that
crossing is the point: a reader follows one request the whole way through.
Never group all the frontend steps together and then all the backend ones,
and never order by "partOf" group - a group gathers declarations that do
one job, while step order follows a single journey.


--------------------------------------------------
LENSES
--------------------------------------------------

lensTags = the perspectives this step can be read through. The vocabulary
is FIXED. Use these ids exactly, in lower case:

${lensCatalogue()}

- Every node gets AT LEAST ONE lens, at most 3.
- Only these ids are accepted: ${LENS_IDS.join(", ")}
- NEVER invent one, and NEVER use a feature name as a lens.
- Choose only what the supplied facts support. A step that checks a token
  is ["backend", "security"]; a form that posts to the server is
  ["frontend", "backend"]; a query that writes a row is ["data"].

--------------------------------------------------
READINGS - the same step, in each perspective's words
--------------------------------------------------

"readings" names this ONE step again for each perspective, in that
perspective's own language and with that perspective's facts. The step does
not change, the code does not change, only the words do - and that is what
makes a project legible to someone who thinks in one of these terms.

The same sign-in step, read four ways:

  "title":    "Sign in with Google"
  "readings": {
    "frontend": "Press the Google sign-in button",
    "backend":  "POST the credential to /auth/google",
    "database": "Keep the session token in local storage",
    "security": "Hand Google's token over to be checked"
  }

And a step that writes rows, where the database reading gets specific:

  "title":    "Save the answers"
  "readings": {
    "frontend": "Confirm the survey was received",
    "backend":  "Accept POST /survey/submit",
    "database": "INSERT one row per answer, in one transaction",
    "security": "Refuse a submission that is missing answers"
  }

Be specific in the way that perspective is specific. A database reading
names the table, the column or the operation when the facts give them. A
backend reading names the route or the status code. A frontend reading names
what the person actually sees happen. A security reading names the check.

Rules:
- Under 8 words each. No function names, no file names.
- Grounded in the SUPPLIED FACTS for that declaration. A reading that the
  facts do not support is worse than no reading.
- Go through all four in turn for every step, and write the ones the facts
  support. Most steps carry two or three. A request handler is a backend
  step; it is also a security step if it rejects anything, and a database
  step if it touches a row. A form handler is frontend AND backend, because
  it gathers input and sends it.
- Write a reading for every perspective the facts DO support, not only for
  the ones in "lensTags".
- Every lens you put in "lensTags" MUST have a reading. Saying a step is
  security work and then finding no security words for it contradicts
  itself.
- OMIT only a perspective the facts genuinely say nothing about. A pure
  layout helper has no data reading, and inventing one ("Touches no
  storage") is noise. Leave it out and the step keeps its plain title
  under that lens.
- Only these keys: ${LENS_IDS.join(", ")}
- Never repeat the title verbatim. If a perspective has nothing new to say
  about this step, omit it.

Every rule MUST have:
- kind: "behaviour"
- target
- assert

Rules must use only these checkable facts, each with the operators its type allows.

Count facts hold a number. Use ">=", "<=", "==" or "!=" with a numeric value:
${NUMERIC_FACT_FIELDS.join("\n")}

List facts hold a list. Use "contains" or "notContains" with ONE item as the value:
throwTypes and calls: the value is a string, such as "Error" or "verifyToken"
numbers: the value is a number, such as 0
entries: the value is a string, such as "ninth_question" or "/auth/start"

A declaration of kind "data" is a named list or table, not a function. Its
throws, returns and awaits are all zero and say nothing; what it holds is
the point. Use entryCount and entries for it:

  "assert": { "entryCount": { "op": ">=", "value": 12 } }
  "assert": { "entries": { "op": "contains", "value": "thank_you" } }

Write its title and readings from what it holds. A list of screen ids in
order is a journey - say so, and say how many steps it has.

Any fact may also use "unchanged" with no value. It passes while the fact stays as it was when the node was approved.

NEVER use ">=", "<=", "==" or "!=" on a list fact. A clause such as "calls": { "op": "==", "value": 0 } can never be verified. To describe a function that calls nothing, leave "calls" out.

ASSERTION FORMAT IS STRICT.

Every property inside "assert" MUST be an object with:
- "op": one of the allowed operators above
- "value": the comparison value

Never use a primitive value directly inside "assert".

Correct:
"assert": {
  "throws": {
    "op": ">=",
    "value": 1
  },
  "returnsNullish": {
    "op": "==",
    "value": 0
  }
}

Incorrect:
"assert": {
  "throws": 1,
  "returnsNullish": 0
}

Incorrect:
"assert": {
  "throws": true
}

Incorrect:
"assert": {
  "returns": "true"
}

Only assert facts that are present in the supplied PlanMap facts.
Do not invent source facts. Use only facts supplied by PlanMap.

Every node must use:
status: "intended"
origin: "ai_drafted"

Existing features:
${JSON.stringify(
    vocabulary.features || []
)}

IMPORTANT VOCABULARY BOUNDARY:
- "feature" MUST be one of the supplied existing feature names.
- "lensTags" MUST contain ONLY ids from the fixed lens list above.
- NEVER put a feature name into "lensTags".

Significant declarations:
${JSON.stringify(
    declarations,
    null,
    2
)}


--------------------------------------------------
COVERAGE
--------------------------------------------------

Return exactly one node for every supplied declaration, with the same
identity, in the same number. Never merge two declarations into one node.
Never leave one out because it seems minor. Never invent one.

A declaration you would rather not describe still gets a node: say plainly
what it must keep doing.


--------------------------------------------------
THE ORDER OF THE FEATURES THEMSELVES
--------------------------------------------------

"featureOrder" lists every feature you used, in the order a person meets
them using the product. Someone signs in before they answer questions, and
pays before an order is tracked, so:

  ["Login", "Survey"]

This is the reader's way in: it is the first thing shown, before any single
step. Order by the journey, never alphabetically and never by how much code
each one holds.


Return this exact top-level shape:

{
  "featureOrder": ["the first feature a person meets", "then the next"],
  "nodes": [
    {
      "identity": "file::name:type",
      "feature": "one of the supplied existing feature names",
      "step": 1,
      "title": "the step, in the product's words",
      "intent": "one sentence: what must stay true",
      "lensTags": ["server"],
      "readings": { "interface": "…", "server": "…", "safety": "…", "data": "…" },
      "rules": [
        {
          "kind": "behaviour",
          "target": "file::name:type",
          "assert": {}
        }
      ]
    }
  ]
}
`.trim();
}


// --------------------------------------------------
// NORMALIZE BROWNFIELD OUTPUT
// --------------------------------------------------
// 1-Adds PlanMap-owned fields.
// 2-Rejects malformed batches.
// 3-Ensures every rule targets its declaration.
// --------------------------------------------------

function normalizeBrownfieldNodes(
    parsed,
    plan,
    candidates,
    dropped = [],
    skipped = [],
    lensesByIdentity = {},
    stageByIdentity = {}
) {
    if (
        !parsed ||
        !Array.isArray(
            parsed.nodes
        )
    ) {
        throw new Error(
            "Brownfield LLM response must contain a nodes array."
        );
    }

    const candidateIdentities =
        new Set(
            candidates.map(
                candidate =>
                    candidate.identity
            )
        );

    const featureIdsByName =
        new Map();

    for (
        const feature of plan.features || []
    ) {
        if (
            !feature ||
            typeof feature.name !==
            "string" ||
            !feature.name.trim()
        ) {
            continue;
        }

        featureIdsByName.set(
            feature.name.trim(),
            feature.id
        );
    }

    const protectedIdentities =
        new Set(
            (plan.nodes || [])
                .filter(
                    node =>
                        node?.identity &&
                        (
                            node.origin ===
                                "human_authored" ||
                            node.origin ===
                                "ai_edited_by_human"
                        )
                )
                .map(
                    node =>
                        node.identity
                )
        );

    const nodes = [];

    const skippedBefore =
        skipped.length;



    let nodeNumber =
        getNextNodeNumber(
            plan
        );

    for (
        const draft of parsed.nodes
    ) {
      // A node the model got wrong is skipped and reported. One bad node
      // must not throw away a draft of hundreds of good ones.
      try {
        if (
            !draft ||
            typeof draft !== "object"
        ) {
            throw new Error(
                "not an object"
            );
        }

        if (
            typeof draft.identity !== "string" ||
            !candidateIdentities.has(
                draft.identity
            )
        ) {
            throw new Error(
                "not one of the declarations it was asked about"
            );
        }

        if (
            protectedIdentities.has(
                draft.identity
            )
        ) {
            continue;
        }

        if (
            typeof draft.title !== "string" ||
            !draft.title.trim()
        ) {
            throw new Error(
                `Brownfield draft for ${draft.identity} has no title.`
            );
        }

        if (
            typeof draft.intent !== "string" ||
            !draft.intent.trim()
        ) {
            throw new Error(
                `Brownfield draft for ${draft.identity} has no intent.`
            );
        }

        if (
            !Array.isArray(
                draft.rules
            ) ||
            draft.rules.length === 0
        ) {
            throw new Error(
                `Brownfield draft for ${draft.identity} must contain behaviour rules.`
            );
        }

        // --------------------------------------------------
        // LENSES
        // --------------------------------------------------
        // The Evolution graph's tags for this exact declaration win. Both
        // views then filter the same code into the same lens, instead of
        // the model deciding twice and disagreeing with itself. What the
        // model returned is the fallback for a declaration evolution has
        // no tags for, mapped onto the fixed vocabulary.
        // --------------------------------------------------

        const lensTags =
            lensesByIdentity[
                draft.identity
            ]?.length
                ? lensesByIdentity[
                    draft.identity
                ]
                : canonicalLenses(
                    draft.lensTags
                );

        // --------------------------------------------------
        // READINGS
        // --------------------------------------------------
        // The same step named again in each perspective's language. Kept
        // only for lenses PlanMap knows, and only where the model actually
        // said something new: a reading that repeats the title adds a
        // rename without adding a reading.
        // --------------------------------------------------

        const readings =
            {};

        const rawReadings =
            draft.readings &&
            typeof draft.readings === "object"
                ? draft.readings
                : {};

        for (
            const lensId of LENS_IDS
        ) {
            const reading =
                typeof rawReadings[lensId] === "string"
                    ? rawReadings[lensId].trim()
                    : "";

            if (
                reading &&
                reading.toLowerCase() !==
                    String(draft.title || "")
                        .trim()
                        .toLowerCase()
            ) {
                readings[lensId] =
                    reading;
            }
        }

        const rules =
            draft.rules.map(
                rule => {
                    if (
                        !rule ||
                        typeof rule !== "object"
                    ) {
                        throw new Error(
                            `Brownfield draft for ${draft.identity} contains an invalid rule.`
                        );
                    }

                    if (
                        rule.kind !==
                        "behaviour"
                    ) {
                        throw new Error(
                            `Brownfield draft for ${draft.identity} contains a non-behaviour rule.`
                        );
                    }

                    if (
                        rule.target !==
                        draft.identity
                    ) {
                        throw new Error(
                            `Brownfield rule target does not match ${draft.identity}.`
                        );
                    }

                    if (
                        !rule.assert ||
                        typeof rule.assert !== "object"
                    ) {
                        throw new Error(
                            `Brownfield draft for ${draft.identity} contains an invalid assertion.`
                        );
                    }

                    // A clause verify can never evaluate (such as
                    // "calls" with "==") would make the node a
                    // permanent verify error, so it is dropped and
                    // reported instead of written to the plan.
                    const assert =
                        Object.fromEntries(
                            Object.entries(
                                rule.assert
                            ).filter(
                                ([field, clause]) => {
                                    const problem =
                                        clauseProblem(
                                            field,
                                            clause
                                        );

                                    if (problem) {
                                        dropped.push(
                                            `${draft.identity}: ${problem}`
                                        );
                                    }

                                    return !problem;
                                }
                            )
                        );

                    return {
                        kind:
                            "behaviour",

                        target:
                            draft.identity,

                        assert
                    };
                }
            )
                .filter(
                    rule =>
                        Object.keys(
                            rule.assert
                        ).length > 0
                );

        let featureId = null;

        if (
            typeof draft.feature ===
            "string"
        ) {
            const featureValue =
                draft.feature.trim();

            if (
                featureIdsByName.has(
                    featureValue
                )
            ) {
                featureId =
                    featureIdsByName.get(
                        featureValue
                    );
            } else if (
                (plan.features || [])
                    .some(
                        feature =>
                            feature?.id ===
                            featureValue
                    )
            ) {
                featureId =
                    featureValue;
            }
        }

        // The scan already decided which stage this declaration belongs to.
        // When the model names something else - usually the broad capability
        // rather than the stage within it - that known answer is better than
        // throwing the whole batch away over a label.
        if (!featureId) {
            const known =
                stageByIdentity[
                    draft.identity
                ];

            if (known) {
                featureId =
                    featureIdsByName.get(
                        known
                    ) || null;
            }
        }

        if (!featureId) {
            throw new Error(
                `Brownfield draft for ${draft.identity} contains an unknown feature.`
            );
        }

        const node = {
            id:
                createId(
                    "plan",
                    nodeNumber++
                ),

            feature:
                featureId,

            identity:
                draft.identity,

            title:
                draft.title.trim(),

            intent:
                draft.intent.trim(),

            lensTags,

            ...(Object.keys(readings).length
                ? { readings }
                : {}),

            edgesOut:
                Array.isArray(
                    draft.edgesOut
                )
                    ? draft.edgesOut
                    : [],

            rules,

            status:
                "intended",

            origin:
                "ai_drafted"
        };

        if (
            Number.isFinite(
                Number(draft.step)
            )
        ) {
            node.step =
                Number(draft.step);
        }

        nodes.push(node);
      } catch (error) {
        skipped.push(
            `${typeof draft?.identity === "string" ? draft.identity : "unnamed node"}: ${error.message}`
        );
      }
    }


    // --------------------------------------------------
    // FAIL CLOSED WHEN THE RESPONSE IS BROADLY WRONG
    // --------------------------------------------------
    // An isolated mistake is skipped and reported above. A response that is
    // mostly wrong is not a draft, and nothing is written.
    // --------------------------------------------------

    const batchSkipped =
        skipped.length -
        skippedBefore;

    if (
        batchSkipped > 0 &&
        (
            nodes.length === 0 ||
            batchSkipped > parsed.nodes.length / 4
        )
    ) {
        throw new Error(
            `Brownfield draft rejected: ${batchSkipped} of ${parsed.nodes.length} nodes were wrong.\n${skipped.slice(skippedBefore).map(line => `- ${line}`).join("\n")}`
        );
    }

    return nodes;
}


// --------------------------------------------------
// LINK EACH FEATURE'S STEPS IN ORDER
// --------------------------------------------------
// The model numbers the steps inside a feature, and those numbers become the
// edges, so a feature reads as the journey a user takes instead of a pile of
// declarations. Batches are numbered independently, so this runs over the
// whole plan: a node keeps its place among everything already drafted.
// The step number itself is working state and does not reach plan.json.
// --------------------------------------------------

function linkFeatureSteps(
    nodes
) {
    const byFeature =
        new Map();

    nodes.forEach(
        (node, index) => {
            if (
                !byFeature.has(node.feature)
            ) {
                byFeature.set(
                    node.feature,
                    []
                );
            }

            byFeature
                .get(node.feature)
                .push({
                    node,
                    index
                });
        }
    );

    for (
        const [, members] of byFeature
    ) {
        members.sort(
            (left, right) => {
                const leftStep =
                    Number.isFinite(left.node.step)
                        ? left.node.step
                        : Number.MAX_SAFE_INTEGER;

                const rightStep =
                    Number.isFinite(right.node.step)
                        ? right.node.step
                        : Number.MAX_SAFE_INTEGER;

                return (
                    leftStep - rightStep ||
                    left.index - right.index
                );
            }
        );

        members.forEach(
            (member, position) => {
                const next =
                    members[position + 1];

                member.node.edgesOut =
                    next
                        ? [next.node.id]
                        : [];
            }
        );
    }

    for (
        const node of nodes
    ) {
        delete node.step;
    }

    return nodes;
}


// --------------------------------------------------
// LINK THE STAGES TO EACH OTHER
// --------------------------------------------------
// The Constellation draws an edge between features when a node in one leads
// to a node in another. Until now nothing ever did, so it always fell back
// to "the order plan.json happens to list them" - an arrow that looked like
// a journey and asserted nothing.
//
// The order is the model's featureOrder, already applied to plan.features.
// Joining each stage's last step to the next stage's first makes the arrow
// mean what it appears to mean: this is where the person goes next.
// --------------------------------------------------

function linkStages(
    plan
) {
    const order =
        plan.features
            .map(
                feature => feature.id
            );

    const inFeature =
        id =>
            plan.nodes.filter(
                node =>
                    node.feature === id
            );

    for (
        let index = 0;
        index < order.length - 1;
        index++
    ) {
        const here =
            inFeature(order[index]);

        const next =
            inFeature(order[index + 1]);

        if (
            here.length === 0 ||
            next.length === 0
        ) {
            continue;
        }

        // The last step of this stage is the one nothing else follows.
        const targets =
            new Set(
                here.flatMap(
                    node => node.edgesOut || []
                )
            );

        const last =
            here.find(
                node =>
                    !targets.has(node.id)
            ) || here[here.length - 1];

        const entered =
            new Set(
                next.flatMap(
                    node => node.edgesOut || []
                )
            );

        const first =
            next.find(
                node =>
                    !entered.has(node.id)
            ) || next[0];

        if (
            last &&
            first &&
            !last.edgesOut.includes(first.id)
        ) {
            last.edgesOut.push(first.id);
        }
    }

    return plan;
}



// --------------------------------------------------
// BROWNFIELD FEATURE SEEDING
// --------------------------------------------------
// 1-Reuses existing plan features.
// 2-Derives new features from evolution vocabulary.
// 3-Keeps deterministic IDs.
// --------------------------------------------------

// --------------------------------------------------
// ORDER THE FEATURES
// --------------------------------------------------
// The Constellation draws one node per feature, in the order the plan lists
// them. Left unordered that reads as an arbitrary stack, so the model is
// asked which order a person meets them in and the list is sorted to match.
// Any feature the model leaves out keeps its current place, after the ones
// it named.
// --------------------------------------------------

function applyFeatureOrder(
    plan,
    featureOrder
) {
    if (
        !Array.isArray(featureOrder) ||
        featureOrder.length === 0
    ) {
        return;
    }

    const rank =
        new Map();

    featureOrder.forEach(
        (name, index) => {
            if (
                typeof name === "string" &&
                name.trim()
            ) {
                rank.set(
                    name.trim().toLowerCase(),
                    index
                );
            }
        }
    );

    const place =
        feature =>
            rank.has(
                String(feature?.name || "")
                    .trim()
                    .toLowerCase()
            )
                ? rank.get(
                    String(feature.name)
                        .trim()
                        .toLowerCase()
                )
                : Number.MAX_SAFE_INTEGER;

    plan.features =
        plan.features
            .map(
                (feature, index) => ({
                    feature,
                    index
                })
            )
            .sort(
                (left, right) =>
                    place(left.feature) -
                        place(right.feature) ||
                    left.index - right.index
            )
            .map(
                entry => entry.feature
            );
}


function ensureBrownfieldVocabulary(
    plan,
    vocabulary
) {
    const existingFeatureNames =
        new Set(
            (plan.features || [])
                .map(
                    feature =>
                        typeof feature?.name ===
                        "string"
                            ? feature.name.trim()
                            : ""
                )
                .filter(Boolean)
        );

    const featureNames =
        Array.isArray(
            vocabulary.features
        )
            ? vocabulary.features
                .filter(
                    value =>
                        typeof value ===
                        "string" &&
                        value.trim()
                )
                .map(
                    value =>
                        value.trim()
                )
            : [];

    for (
        const name of featureNames
    ) {
        if (
            existingFeatureNames.has(
                name
            )
        ) {
            continue;
        }

        plan.features.push({
            id:
                createId(
                    "feat",
                    getNextFeatureNumber(
                        plan
                    )
                ),

            name,

            status:
                "intended",

            source:
                "derived"
        });

        existingFeatureNames.add(
            name
        );
    }

    // --------------------------------------------------
    // LENSES
    // --------------------------------------------------
    // The fixed vocabulary, in its own order, whether or not this project's
    // scan has produced a declaration for each one yet. The Plan Graph and
    // the Evolution graph then offer the same perspectives in the same
    // order, and a lens reads as empty rather than as missing.
    // --------------------------------------------------

    const existingLensIds =
        new Set(
            (plan.lenses || [])
                .map(
                    lens =>
                        typeof lens?.id ===
                        "string"
                            ? lens.id.trim()
                            : ""
                )
                .filter(Boolean)
        );

    for (
        const lens of LENSES
    ) {
        if (
            existingLensIds.has(lens.id)
        ) {
            continue;
        }

        plan.lenses.push({
            id:
                lens.id,

            label:
                lens.label,

            source:
                "derived",

            derivedFrom:
                "planmap.lenses"
        });
    }
}



// --------------------------------------------------
// BROWNFIELD DRAFT
// --------------------------------------------------
// 1-Loads the current plan.
// 2-Collects significant declarations.
// 3-Processes them in deterministic batches.
// 4-Persists each validated successful batch.
// 5-Never touches human-authored nodes.
// --------------------------------------------------

export async function draftBrownfield(
    projectRoot
) {
    requireOpenRouterApiKey();

    const evolution =
        readEvolution(
            projectRoot
        );

    if (
        !Array.isArray(evolution?.nodes) ||
        evolution.nodes.length === 0
    ) {
        throw new Error(
            "Cannot draft: no evolution history found. " +
            "Run 'planmap evolution <project>' first."
        );
    }

    const candidates =
        collectBrownfieldCandidates(
            projectRoot
        );

    if (
        candidates.length === 0
    ) {
        return {
            drafted:
                0,

            batches:
                0
        };
    }

    const plan =
        readPlan(
            projectRoot
        );

    const vocabulary =
        getEvolutionVocabulary(
            evolution,
            plan
        );

    // The Constellation is one node per feature, joined in order, so the
    // plan's features are the journey's stages rather than its two or three
    // broad capabilities. The classification has already found them, filed
    // as the first heading under each capability, so they are promoted here
    // instead of being asked for a second time.
    //
    // An authoritative plan keeps its own features: they were approved.
    if (
        !vocabulary.authoritative
    ) {
        const stages =
            getEvolutionStages(
                evolution
            );

        if (
            stages.length > vocabulary.features.length
        ) {
            vocabulary.features =
                stages;
        }
    }

    if (
        !Array.isArray(
            vocabulary.features
        ) ||
        vocabulary.features.length === 0
    ) {
        throw new Error(
            "Cannot draft: no features found in the evolution graph. " +
            "The scan labelled from file paths, which names no features. " +
            "Run 'planmap evolution <project>' again with a model configured: " +
            "OPENROUTER_API_KEY, or PLANMAP_LLM_ENDPOINT for a local one."
        );
    }

    ensureBrownfieldVocabulary(
        plan,
        vocabulary
    );

    // A declaration whose node a person has ruled on is settled: it is not
    // sent to the model, so it costs nothing to redraft and cannot come back
    // as a second node for the same identity.
    const settled =
        new Set(
            (plan.nodes || [])
                .filter(
                    node =>
                        node?.status === "approved" ||
                        (Array.isArray(node?.history) &&
                            node.history.length > 0)
                )
                .map(
                    node => node.identity
                )
                .filter(Boolean)
        );

    const open =
        candidates.filter(
            candidate =>
                !settled.has(
                    candidate.identity
                )
        );

    if (
        open.length === 0
    ) {
        return {
            drafted: 0,
            batches: 0,
            dropped: [],
            skipped: [],
            settled: settled.size
        };
    }

    const baseline =
        readBaseline(
            projectRoot
        );

    // --------------------------------------------------
    // WHAT EVOLUTION ALREADY DECIDED
    // --------------------------------------------------
    // Per identity: the lenses it is seen through, and the feature and
    // group it sits in. The plan reuses both so the two graphs describe
    // the same code the same way. Later nodes win, being the newer word
    // on a declaration that has changed.
    // --------------------------------------------------

    const lensesByIdentity =
        {};

    const groupByIdentity =
        {};

    // Which stage each declaration already belongs to: its first heading
    // when that heading became a stage of its own, and the capability
    // otherwise. Used when the model names a feature outside the list.
    const stageByIdentity =
        {};

    for (
        const node of evolution.nodes || []
    ) {
        if (
            !node?.identity
        ) {
            continue;
        }

        const lenses =
            canonicalLenses(
                node.tags
            );

        if (
            lenses.length > 0
        ) {
            lensesByIdentity[
                node.identity
            ] = lenses;
        }

        const feature =
            typeof node.feature === "string"
                ? node.feature.trim()
                : "";

        const trail =
            Array.isArray(node.path)
                ? node.path
                : [node.group];

        if (
            feature
        ) {
            const head =
                typeof trail[0] === "string"
                    ? trail[0].trim()
                    : "";

            stageByIdentity[
                node.identity
            ] =
                head &&
                vocabulary.features.includes(head)
                    ? head
                    : vocabulary.features.includes(feature)
                        ? feature
                        : stageByIdentity[node.identity];

            groupByIdentity[
                node.identity
            ] = {
                feature,

                ...(trail.filter(Boolean).length
                    ? { headings: trail.filter(Boolean) }
                    : {})
            };
        }
    }

    const factsByIdentity =
        {};

    for (
        const candidate of open
    ) {
        factsByIdentity[
            candidate.identity
        ] =
            getEvolutionFacts(
                projectRoot,
                {
                    identity:
                        candidate.identity,

                    type:
                        candidate.type
                }
            );
    }

    // --------------------------------------------------
    // GROUP BY SOURCE DIRECTORY
    // --------------------------------------------------
    // 1-Keeps related declarations together.
    // 2-Chunks each directory at 30 declarations.
    // 3-Preserves deterministic ordering.
    // --------------------------------------------------

    const directoryGroups =
        new Map();

    for (
        const candidate of open
    ) {
        const separator =
            candidate.identity.indexOf(
                "::"
            );

        const filePath =
            separator === -1
                ? candidate.identity
                : candidate.identity.slice(
                    0,
                    separator
                );

        const lastSlash =
            filePath.lastIndexOf(
                "/"
            );

        const directory =
            lastSlash === -1
                ? "."
                : filePath.slice(
                    0,
                    lastSlash
                );

        if (
            !directoryGroups.has(
                directory
            )
        ) {
            directoryGroups.set(
                directory,
                []
            );
        }

        directoryGroups
            .get(directory)
            .push(candidate);
    }

    // One request per batch, packed across directories: a model that sees a
    // whole feature at once can order its steps and name them consistently.
    // A local model gets smaller batches, its context being smaller.
    const batchSize =
        Number.parseInt(
            process.env.PLANMAP_LLM_BATCH_SIZE ?? "",
            10
        ) > 0
            ? Number.parseInt(
                process.env.PLANMAP_LLM_BATCH_SIZE,
                10
            )
            : isLocalLlm()
                ? 10
                : 30;

    const sortedCandidates =
        [...directoryGroups.keys()]
            .sort()
            .flatMap(
                directory =>
                    directoryGroups.get(directory)
            );

    const batchesList =
        [];

    for (
        let start = 0;
        start < sortedCandidates.length;
        start += batchSize
    ) {
        batchesList.push(
            sortedCandidates.slice(
                start,
                start + batchSize
            )
        );
    }

    let drafted =
        0;

    let batches =
        0;

    const dropped =
        [];

    const skipped =
        [];

    for (
        const batch of batchesList
    ) {
        batches +=
            1;

        const prompt =
            buildBrownfieldPrompt(
                batch,
                factsByIdentity,
                vocabulary,
                groupByIdentity
            );

        const parsed =
            await callOpenRouter(
                prompt
            );

        const nodes =
            normalizeBrownfieldNodes(
                parsed,
                plan,
                batch,
                dropped,
                skipped,
                lensesByIdentity,
                stageByIdentity
            );

        const batchIdentities =
            new Set(
                batch.map(
                    candidate =>
                        candidate.identity
                )
            );

        const preservedNodes =
            (plan.nodes || [])
                .filter(
                    node => {
                        if (
                            !batchIdentities.has(
                                node?.identity
                            )
                        ) {
                            return true;
                        }

                        // A node a person has ruled on is theirs, whoever
                        // first drafted it. Replacing an approved node threw
                        // that decision away silently - and with it every
                        // verify result measured against it, since verify
                        // only checks approved nodes.
                        if (
                            node?.status === "approved" ||
                            (Array.isArray(node?.history) &&
                                node.history.length > 0)
                        ) {
                            return true;
                        }

                        return (
                            node?.origin !==
                                "ai_drafted"
                        );
                    }
                );

        applyFeatureOrder(
            plan,
            parsed?.featureOrder
        );

        const linked =
            linkFeatureSteps([
                ...preservedNodes,
                ...nodes
            ]);

        // A feature no node belongs to draws an empty box on the
        // Constellation. Features are derived from the scan and the
        // vocabulary shifts between runs, so leftovers accumulate; a
        // feature earns its place by holding a step.
        const used =
            new Set(
                linked.map(
                    node => node.feature
                )
            );

        const nextPlan = {
            ...plan,

            features:
                plan.features.filter(
                    feature =>
                        used.has(feature.id)
                ),

            nodes:
                linked
        };

        const errors =
            validatePlan(
                nextPlan
            );

        if (
            errors.length > 0
        ) {
            throw new Error(
                `Brownfield draft validation failed:\n${errors
                    .map(
                        error =>
                            `- ${error}`
                    )
                    .join("\n")}`
            );
        }

        linkStages(
            nextPlan
        );

        writePlan(
            projectRoot,
            nextPlan
        );

        plan.nodes =
            nextPlan.nodes;

        plan.features =
            nextPlan.features;

        plan.lenses =
            nextPlan.lenses;

        drafted +=
            nodes.length;

        if (
            nodes.length < batch.length
        ) {
            console.log(
                `Batch ${batches}: ${nodes.length} of ${batch.length} declarations drafted; the rest are retried on the next run.`
            );
        }
    }

    return {
        drafted,
        batches,
        dropped,
        skipped
    };
}



// --------------------------------------------------
// BUILD GREENFIELD PROMPT
// --------------------------------------------------
// 1-Describes a project that does not have an implementation yet.
// 2-Requests lenses, features, and intent nodes.
// 3-Forbids implementation identities and behaviour rules.
// 4-Uses temporary IDs so edgesOut can be normalized deterministically.
// --------------------------------------------------

function buildGreenfieldPrompt(
    description
) {
    return `
You are drafting a PlanMap v0.6 greenfield development plan.

Return ONLY valid JSON.

There is NO existing implementation to inspect.
The user has provided this product/project description:

${description}

Create a structured plan containing:
- lenses
- features
- nodes

Greenfield nodes describe intended behaviour before implementation exists.

Every node MUST contain:
- id
- feature
- title
- intent
- lensTags
- edgesOut
- status
- origin

Greenfield nodes MUST NOT contain:
- identity
- rules

Do NOT invent source files, function names, declarations, or implementation details.

Every node must use:
- status: "intended"
- origin: "ai_drafted"

FEATURES

Each feature MUST contain:
- id
- name

Use temporary feature IDs such as:
- feature_tmp_1
- feature_tmp_2

LENSES

Each lens MUST contain:
- id
- label

Use temporary lens IDs such as:
- lens_tmp_1
- lens_tmp_2

NODES

Use temporary node IDs such as:
- node_tmp_1
- node_tmp_2

The "feature" field of every node MUST reference one of the
temporary feature IDs returned in "features".

The "lensTags" field MUST contain only temporary lens IDs
returned in "lenses".

The "edgesOut" field MUST contain only temporary node IDs
returned in "nodes".

Edges represent workflow ordering between intended requirements.
Do not create edges to nodes that do not exist.

Do not include:
- identity
- rules
- source paths
- function names
- implementation facts
- approved facts
- approval metadata

Return this exact top-level shape:

{
  "lenses": [
    {
      "id": "lens_tmp_1",
      "label": "Security"
    }
  ],
  "features": [
    {
      "id": "feature_tmp_1",
      "name": "Authentication"
    }
  ],
  "nodes": [
    {
      "id": "node_tmp_1",
      "feature": "feature_tmp_1",
      "title": "Verify credentials before issuing a session",
      "intent": "Credentials must be validated before a session can be created.",
      "lensTags": ["lens_tmp_1"],
      "edgesOut": ["node_tmp_2"],
      "status": "intended",
      "origin": "ai_drafted"
    }
  ]
}

Keep the plan focused on meaningful product behaviour and requirements.
Do not create unnecessary technical implementation steps.
`.trim();
}


// --------------------------------------------------
// NORMALIZE GREENFIELD OUTPUT
// --------------------------------------------------
// 1-Validates the LLM greenfield structure.
// 2-Replaces temporary IDs with PlanMap-owned IDs.
// 3-Guarantees greenfield nodes have no identity or rules.
// 4-Preserves workflow edges after ID normalization.
// --------------------------------------------------

function normalizeGreenfieldPlan(
    parsed,
    existingPlan
) {
    if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
    ) {
        throw new Error(
            "Greenfield LLM response must be an object."
        );
    }

    if (
        !Array.isArray(parsed.lenses)
    ) {
        throw new Error(
            "Greenfield LLM response must contain a lenses array."
        );
    }

    if (
        !Array.isArray(parsed.features)
    ) {
        throw new Error(
            "Greenfield LLM response must contain a features array."
        );
    }

    if (
        !Array.isArray(parsed.nodes)
    ) {
        throw new Error(
            "Greenfield LLM response must contain a nodes array."
        );
    }

    const nextFeatureNumber =
        getNextFeatureNumber(
            existingPlan
        );

    const nextLensNumber =
        (
            existingPlan.lenses || []
        ).reduce(
            (
                maximum,
                lens
            ) => {
                const match =
                    /^lens_(\d+)$/.exec(
                        lens?.id || ""
                    );

                if (!match) {
                    return maximum;
                }

                return Math.max(
                    maximum,
                    Number(
                        match[1]
                    )
                );
            },
            0
        ) + 1;

    const nextNodeNumber =
        getNextNodeNumber(
            existingPlan
        );

    const existingFeatureNames =
        new Set(
            (existingPlan.features || [])
                .filter(
                    feature =>
                        feature?.source !==
                        "derived"
                )
                .map(
                    feature =>
                        typeof feature?.name ===
                        "string"
                            ? feature.name.trim()
                            : ""
                )
                .filter(Boolean)
        );

    const existingLensLabels =
        new Set(
            (existingPlan.lenses || [])
                .filter(
                    lens =>
                        lens?.source ===
                        "human_added"
                )
                .map(
                    lens =>
                        typeof lens?.label ===
                        "string"
                            ? lens.label.trim()
                            : ""
                )
                .filter(Boolean)
        );

    const featureIdMap =
        new Map();

    const lensIdMap =
        new Map();

    const nodeIdMap =
        new Map();

    const lenses =
        [];

    const features =
        [];

    let featureNumber =
        nextFeatureNumber;

    for (
        const feature of parsed.features
    ) {
        if (
            !feature ||
            typeof feature !== "object" ||
            Array.isArray(feature)
        ) {
            throw new Error(
                "Greenfield feature must be an object."
            );
        }

        if (
            typeof feature.id !== "string" ||
            !feature.id.trim()
        ) {
            throw new Error(
                "Greenfield feature must have a temporary id."
            );
        }

        if (
            typeof feature.name !== "string" ||
            !feature.name.trim()
        ) {
            throw new Error(
                "Greenfield feature must have a name."
            );
        }

        const name =
            feature.name.trim();

        if (
            existingFeatureNames.has(
                name
            )
        ) {
            throw new Error(
                `Greenfield feature duplicates an existing feature: ${name}`
            );
        }

        if (
            featureIdMap.has(
                feature.id
            )
        ) {
            throw new Error(
                `Duplicate greenfield feature id: ${feature.id}`
            );
        }

        const id =
            createId(
                "feat",
                featureNumber
            );

        featureNumber +=
            1;

        featureIdMap.set(
            feature.id,
            id
        );

        existingFeatureNames.add(
            name
        );

        features.push({
            id,
            name,
            status: "intended",
            source: "derived"
        });
    }

    let lensNumber =
        nextLensNumber;

    for (
        const lens of parsed.lenses
    ) {
        if (
            !lens ||
            typeof lens !== "object" ||
            Array.isArray(lens)
        ) {
            throw new Error(
                "Greenfield lens must be an object."
            );
        }

        if (
            typeof lens.id !== "string" ||
            !lens.id.trim()
        ) {
            throw new Error(
                "Greenfield lens must have a temporary id."
            );
        }

        if (
            typeof lens.label !== "string" ||
            !lens.label.trim()
        ) {
            throw new Error(
                "Greenfield lens must have a label."
            );
        }

        const label =
            lens.label.trim();

        if (
            existingLensLabels.has(
                label
            )
        ) {
            throw new Error(
                `Greenfield lens duplicates an existing lens: ${label}`
            );
        }

        if (
            lensIdMap.has(
                lens.id.trim()
            )
        ) {
            throw new Error(
                `Duplicate greenfield lens id: ${lens.id}`
            );
        }

        const id =
            createId(
                "lens",
                lensNumber
            );

        lensNumber +=
            1;

        lensIdMap.set(
            lens.id.trim(),
            id
        );

        existingLensLabels.add(
            label
        );

        lenses.push({
            id,
            label,
            source: "derived"
        });
    }

    let nodeNumber =
        nextNodeNumber;

    for (
        const node of parsed.nodes
    ) {
        if (
            !node ||
            typeof node !== "object" ||
            Array.isArray(node)
        ) {
            throw new Error(
                "Greenfield node must be an object."
            );
        }

        if (
            typeof node.id !== "string" ||
            !node.id.trim()
        ) {
            throw new Error(
                "Greenfield node must have a temporary id."
            );
        }

        if (
            nodeIdMap.has(
                node.id
            )
        ) {
            throw new Error(
                `Duplicate greenfield node id: ${node.id}`
            );
        }

        if (
            node.identity !== undefined
        ) {
            throw new Error(
                "Greenfield nodes must not contain identity."
            );
        }

        if (
            node.rules !== undefined
        ) {
            throw new Error(
                "Greenfield nodes must not contain rules."
            );
        }

        if (
            typeof node.feature !== "string" ||
            !node.feature.trim()
        ) {
            throw new Error(
                "Greenfield node must reference a feature."
            );
        }

        const featureId =
            featureIdMap.get(
                node.feature.trim()
            );

        if (
            !featureId
        ) {
            throw new Error(
                `Greenfield node references unknown feature: ${node.feature}`
            );
        }

        if (
            typeof node.title !== "string" ||
            !node.title.trim()
        ) {
            throw new Error(
                "Greenfield node must have a title."
            );
        }

        if (
            typeof node.intent !== "string" ||
            !node.intent.trim()
        ) {
            throw new Error(
                "Greenfield node must have intent."
            );
        }

        if (
            !Array.isArray(node.lensTags)
        ) {
            throw new Error(
                "Greenfield node lensTags must be an array."
            );
        }

        if (
            !Array.isArray(node.edgesOut)
        ) {
            throw new Error(
                "Greenfield node edgesOut must be an array."
            );
        }

        for (
            const lensTag of node.lensTags
        ) {
            if (
                typeof lensTag !== "string" ||
                !lensIdMap.has(
                    lensTag.trim()
                )
            ) {
                throw new Error(
                    `Greenfield node references unknown lens: ${lensTag}`
                );
            }
        }

        for (
            const edge of node.edgesOut
        ) {
            if (
                typeof edge !== "string"
            ) {
                throw new Error(
                    "Greenfield edgesOut must contain temporary node ids."
                );
            }
        }

        const id =
            createId(
                "plan",
                nodeNumber
            );

        nodeNumber +=
            1;

        nodeIdMap.set(
            node.id.trim(),
            id
        );
    }

    const nodes =
        parsed.nodes.map(
            node => ({
                id:
                    nodeIdMap.get(
                        node.id.trim()
                    ),

                feature:
                    featureIdMap.get(
                        node.feature.trim()
                    ),

                title:
                    node.title.trim(),

                intent:
                    node.intent.trim(),

                lensTags:
                    node.lensTags.map(
                        lensTag =>
                            lensIdMap.get(
                                lensTag.trim()
                            )
                    ),

                edgesOut:
                    node.edgesOut.map(
                        edge => {
                            const target =
                                nodeIdMap.get(
                                    edge.trim()
                                );

                            if (
                                !target
                            ) {
                                throw new Error(
                                    `Greenfield node references unknown edge target: ${edge}`
                                );
                            }

                            return target;
                        }
                    ),

                status:
                    "intended",

                origin:
                    "ai_drafted"
            })
        );

    return {
        lenses,
        features,
        nodes
    };
}
// --------------------------------------------------
// GREENFIELD DRAFT
// --------------------------------------------------
// 1-Does not require an existing implementation.
// 2-Requests one atomic LLM draft.
// 3-Validates before writing.
// --------------------------------------------------

export async function draftGreenfield(
    projectRoot,
    description
) {
    if (
        typeof description !== "string" ||
        !description.trim()
    ) {
        throw new Error(
            "Greenfield drafting requires a description."
        );
    }

    requireOpenRouterApiKey();

    const existingPlan =
        readPlan(
            projectRoot
        );

    const prompt =
        buildGreenfieldPrompt(
            description.trim()
        );

    const parsed =
        await callOpenRouter(
            prompt
        );

    const drafted =
        normalizeGreenfieldPlan(
            parsed,
            existingPlan
        );

    // --------------------------------------------------
    // 1-Reuse human-owned plan content.
    // 2-Regenerate AI-derived greenfield vocabulary.
    // 3-Never replace human-authored or human-edited nodes.
    // --------------------------------------------------

    const preservedNodes =
        (existingPlan.nodes || [])
            .filter(
                node =>
                    node?.origin !== "ai_drafted"
            );

    const preservedLenses =
        (existingPlan.lenses || [])
            .filter(
                lens =>
                    lens?.source === "human_added"
            );

    const preservedFeatures =
        (existingPlan.features || [])
            .filter(
                feature =>
                    feature?.source !== "derived"
            );

    // --------------------------------------------------
    // 4-Only generated greenfield vocabulary is replaced.
    // 5-Human-owned features remain untouched.
    // --------------------------------------------------

    const nextPlan = {
        ...existingPlan,

        lenses: [
            ...preservedLenses,
            ...drafted.lenses
        ],

        features: [
            ...preservedFeatures,
            ...drafted.features
        ],

        nodes: [
            ...preservedNodes,
            ...drafted.nodes
        ]
    };

    const errors =
        validatePlan(
            nextPlan
        );

    if (
        errors.length > 0
    ) {
        throw new Error(
            `Greenfield draft validation failed:\n${errors
                .map(
                    error =>
                        `- ${error}`
                )
                .join("\n")}`
        );
    }

    writePlan(
        projectRoot,
        nextPlan
    );

    return nextPlan;
}
