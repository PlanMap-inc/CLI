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
    evaluateClause,
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
    getEvolutionVocabulary
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

import {
    BEHAVIOUR_LINE
} from "../llm/behaviour.js";

import {
    DEFAULT_ROLE,
    ROLE_IDS,
    canonicalRole,
    proposeRole,
    roleCatalogue
} from "../llm/roles.js";

import {
    buildCallGraph
} from "../baseline/callgraph.js";

import {
    siblingFamilies
} from "../baseline/families.js";


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

// A declaration's family, keeping only the siblings that are in this batch.
// Offering one that is not would invite a node about a declaration the model
// was never given, which normalize rejects.
function familyIn(
    family,
    candidates
) {
    if (
        !family
    ) {
        return {};
    }

    const here =
        new Set(
            candidates.map(
                candidate =>
                    candidate.identity
            )
        );

    const siblings =
        family.siblings.filter(
            identity =>
                here.has(identity)
        );

    return siblings.length > 0
        ? { siblings, varies: family.varies }
        : {};
}


function buildBrownfieldPrompt(
    candidates,
    factsByIdentity,
    vocabulary,
    groupByIdentity = {},
    roleByIdentity = {},
    familyByIdentity = {}
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

                // What the facts suggest this declaration is FOR. A
                // starting point, not a verdict: the model sees it beside
                // the facts and may overrule it.
                roleProposal:
                    roleByIdentity[
                        candidate.identity
                    ] || DEFAULT_ROLE,

                // Declarations whose names differ from this one by a single
                // word - a family PlanMap spotted. Narrowed to this batch,
                // because a node can only be written about declarations it
                // was given. A candidate for merging, nothing more.
                ...familyIn(
                    familyByIdentity[
                        candidate.identity
                    ],
                    candidates
                ),

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
- identities
- role
- feature
- step
- title
- intent
- lensTags
- readings
- rules


--------------------------------------------------
ROLE - WHAT THIS DECLARATION IS FOR
--------------------------------------------------

Decide this FIRST. It decides how the declaration is drawn, and everything
else you write about it follows from it.

A feature used to be drawn as one step per declaration, and it read like
this:

  Verify user credentials          a behaviour
  Define database configuration    a set of terms
  Connect the database pool        a precondition
  Convert values to string         a helper

Four true sentences that explain nothing together, because the reader has to
sort them into four piles before the list means anything. You do the sorting.

${roleCatalogue()}

Each declaration carries "roleProposal": what its facts suggest. It is a
starting point. Overrule it whenever the facts read otherwise - the proposal
knows the shape of the code, and you know what it is for.

THE TEST FOR A BEHAVIOUR: can you name a trigger and an outcome? Something
that sets it off, and something observably different afterwards. "A sign-in
form is submitted -> a session token comes back" is a behaviour. A list of
column names has neither, however important it is.

Most declarations are behaviours. Do not reach for the other three to tidy a
long feature - a step moved out of the spine to shorten it is a step the
reader can no longer find.

--------------------------------------------------
IDENTITIES - WHEN SEVERAL DECLARATIONS ARE ONE STEP
--------------------------------------------------

"identities" is a LIST. Usually it holds one declaration:

  "identities": ["api/main.py::submit_survey:function"]

But a project often writes one behaviour several times over, once per thing
it applies to:

  get_agencies      get_mps      get_districts      get_states

Four declarations, one behaviour, four nouns. Drawn as four steps they cost
the reader four rows to learn one thing, and the difference between them -
which was never the point - is the only thing four rows can show.

PlanMap has already looked for these. A declaration whose name differs from
others by a single word carries "siblings" - the others - and "varies", the
words that tell them apart. WHEN YOU SEE "siblings", STOP AND DECIDE: is
this one behaviour over several things, or several behaviours?

  ONE behaviour    the same work, over a different noun each time
                   get_agencies / get_mps / get_districts
                   -> merge them

  SEVERAL          the verb differs, so the work differs
                   get_report / delete_report
                   post_report / remove_report
                   -> leave them apart, whatever their names look like

The test is the verb, and then the assert. Two declarations that READ and
two that WRITE are two behaviours even when PlanMap grouped them.

Where they are one behaviour, write ONE node listing all of them:

  "identities": ["api/main.py::get_agencies:function",
                 "api/main.py::get_mps:function",
                 "api/main.py::get_districts:function",
                 "api/main.py::get_states:function"],
  "title": "Look up the risk score for any scope",
  "dimensions": ["agency", "MP", "district", "state"]

THE TEST, AND IT IS STRICT. Merge only when ONE rule assert is true of EVERY
declaration you are merging. If you cannot write a single assert that holds
for all of them, they are different behaviours and MUST stay separate.

That is the whole gate. Not "they look similar", not "they are in the same
file", not "the feature is long". One assert, true of all of them.

  RIGHT - one assert covers all four:
    four lookups that each call the same store method with a different name

  WRONG - no single assert covers these:
    "Verify the token" and "Connect the pool"
    "Create a channel" and "Delete a channel"      different behaviours
    everything in a long feature, merged to shorten it

"dimensions" is what varies across the merged declarations, in the product's
own words - the nouns, not the function names. Omit it for a single-identity
node.

Every declaration you were given must appear in exactly one node's
"identities". None twice, none left out.

--------------------------------------------------
TITLE AND INTENT QUALITY
--------------------------------------------------

A plan reads as the product's own story, in the order a user lives it. The
reader is answering one question at every node: what is the system doing
here? Not: what does this function sound like?
${BEHAVIOUR_LINE}
The title obeys that standard exactly. It also never contains a function
name or a file name - those are printed underneath it as evidence.

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
READINGS - only where a perspective has something of its own to say
--------------------------------------------------

"readings" is an object keyed by lens id. Unlike "lensTags", it does NOT
need every key, and it is normal for it to need none at all. Most steps
carry one or two.

A reading exists for exactly one reason: that lens's own question -
${lensCatalogue()}
-
has an answer at THIS step that the title does not already give a reader
asking it. If the honest answer is "nothing new from here", leave the key
out. An omitted key is not a gap for you to fill. It is the correct, final
answer for a step that lens has nothing to add to.

DO NOT write a reading for every lens on every step to be thorough. That
produces the same sentence spoken four ways, which teaches a reader nothing
past the title - and reads as though the step changed identity four times
rather than being explained from four angles.

DO NOT manufacture a reading out of a lens's silence. A line matching any of
these shapes is worse than no reading, because it looks like an answer while
saying nothing about THIS step - it would be equally true of most steps in
most features:

  Nothing happens here, Nothing is read, Nothing is written, No checks occur
  here, No checks happen here, No access checks apply, No server call
  happens here, No rows are read, The server waits, Not visible to the
  user, Nothing changes, Anyone may see it

If a lens genuinely has nothing of its own to say, that fact is expressed by
the key being ABSENT. Never by a sentence that says so.

WHEN A LENS DOES HAVE SOMETHING - EACH VOICE IS SPECIFIC IN ITS OWN WAY

  frontend  names what the person sees or does
            "Press the book-a-collection button", not "handle the response"
  backend   names the route, the verb, the status code
            "Answer 200, or 409 on a duplicate", not "return status code"
  database  names the table, the column, the operation
            "Insert one row per parcel, in one transaction",
            not "handle the saving"
  security  names the check and what happens when it fails
            "Reject a booking with no address", not "verify the data"

Those are shapes from another project. Take the form; take your nouns from
the declarations you were given.

A reading is held to the same standard as a title - the whole standard,
including the banned phrases in behaviour.js. This is where vague lines have
come from before, because a reading feels like a gloss and gets written
like one. It is not a gloss: it is that perspective's own explanation of
what the system does at this step, grounded in the supplied facts, and it
must stand on its own.

A step's OWN lensTags almost always earn a reading of their own - that
perspective is doing the work, so it has the most to say. A lens the step
merely touches, without doing that lens's kind of work, earns a reading only
when something concrete and specific is true from that angle; most such
steps earn none, and that is expected, not a shortfall.

READ IT BACK BEFORE YOU ANSWER

Take one lens's readings, in step order, skipping the steps where it is
silent. Could someone who only ever read that lens follow the parts of this
feature it actually speaks to? If any two of its readings could swap places
without a reader noticing, both are too vague - rewrite both, or drop the
weaker one rather than keep a line that says nothing distinct.

RULES

- Three to eight words each. No function names, no file names.
- Grounded in the SUPPLIED FACTS. Never invent a route, table or check the
  facts do not show.
- Never repeat the title verbatim, or say the same thing in other words.
- Only these keys are ever valid: ${LENS_IDS.join(", ")}. Include a key only
  when that lens has something of its own to say about THIS step.
- "lensTags" stays what it is: the perspectives that DO THE WORK. A reading
  from a lens the step merely touches does not earn it a tag.

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

Every supplied declaration must appear in exactly one node's "identities".
Never leave one out because it seems minor. Never invent one that was not
supplied.

Usually that means one node per declaration. It means fewer only where the
merge test above is met: ONE assert true of every declaration merged. A
declaration you would rather not describe still gets a node of its own: say
plainly what it must keep doing.

Count before you answer. The identities across all your nodes, added up,
must equal the number of declarations you were given, with no repeats.

That count is why merging costs you nothing: four declarations in one node
still count as four. Fewer NODES, never fewer declarations.


--------------------------------------------------
BEFORE YOU ANSWER - CHECK EVERY LINE
--------------------------------------------------

Take each title and each reading you have written and put six questions to
it. A line that fails any of them is rewritten, not shipped.

  1. Could a developer who has never opened this file say what this step
     does, from this line alone?
  2. Does it describe behaviour, or is it the function name in other words?
  3. Is it specific enough that no neighbouring line could be swapped for
     it?
  4. Does every content word trace back to a supplied fact or to the
     declaration's own name?
  5. Read in step order, do the feature's lines tell what the software does
     from start to finish?
  6. Is the object named - a survey response, a JWT signature, the users
     record - rather than "the data", "the send", "the request"?
  7. Does it begin with a real verb? Scan every line you wrote for a
     first word of Handle, Process, Manage, Execute, Perform, Run, Do,
     Support, Implement or Ensure, and replace it with what actually
     happens to the object.
  8. Is every node whose role is "behaviour" something with a trigger and
     an outcome? A node that only says what exists is vocabulary, and one
     that only says what is running is machinery. Move it.
  9. Do the nodes you merged share ONE assert that is true of all of them?
     If not, split them back apart.


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


BEFORE YOU WRITE THE JSON: go back through the declarations you were given
and find every one carrying "siblings". For each family, say to yourself
whether it is one behaviour over several nouns or several behaviours. Every
family that is one behaviour becomes ONE node with all of their identities.
A draft that merges nothing on a project full of families has not done this
step - it has defaulted.

Return this exact top-level shape:

{
  "featureOrder": ["the first feature a person meets", "then the next"],
  "nodes": [
    {
      "identities": ["file::name:type"],
      "role": "behaviour",
      "feature": "one of the supplied existing feature names",
      "step": 1,
      "_comment": "one declaration - the ordinary case",
      "title": "verb + object: what the system does here",
      "intent": "one sentence: what must stay true",
      "lensTags": ["backend"],
      "readings": { "security": "…" },
      "_comment2": "only the lenses that genuinely have something new to say - one here, none is just as normal, four is rare",
      "rules": [
        {
          "kind": "behaviour",
          "target": "file::name:type",
          "assert": {}
        }
      ]
    },
    {
      "identities": ["api/main.py::get_agencies:function",
                     "api/main.py::get_mps:function",
                     "api/main.py::get_states:function"],
      "role": "behaviour",
      "feature": "one of the supplied existing feature names",
      "step": 2,
      "dimensions": ["agency", "MP", "state"],
      "title": "one behaviour, read across all three",
      "intent": "one sentence true of all three",
      "lensTags": ["backend"],
      "readings": {},
      "rules": [
        {
          "kind": "behaviour",
          "target": "api/main.py::get_agencies:function",
          "assert": {}
        }
      ]
    }
  ]
}

Do not copy the "_comment" key into your answer - it is there to label the
two shapes. The second shape is not rare: on a project that repeats a
behaviour per noun, several of your nodes should look like it.


--------------------------------------------------
LAST CHECK - THE ROLL CALL
--------------------------------------------------

You were given ${declarations.length} declarations. Before you answer, read
the list below and tick each one off against your nodes. Every identity must
appear in exactly one node's "identities" array.

${declarations.map(entry => `  ${entry.identity}`).join("\n")}

This is the failure this prompt exists to prevent: merging four declarations
in your head, writing one node, and listing one identity. The other three
then vanish from the plan and nobody finds out. A merged node LISTS EVERY
DECLARATION IT MERGED.

${declarations.length} identities in. ${declarations.length} identities out,
spread over however many nodes you wrote.
`.trim();
}


// --------------------------------------------------
// WHICH DECLARATIONS A DRAFT NODE STANDS FOR
// --------------------------------------------------
// "identities" is the shape asked for. "identity" is accepted beside it so a
// model that answers in the older single-declaration shape still drafts, and
// so do the fixtures written against it.
// --------------------------------------------------

function draftIdentities(
    draft
) {
    const raw =
        Array.isArray(draft?.identities)
            ? draft.identities
            : [draft?.identity];

    return [
        ...new Set(
            raw.filter(
                value =>
                    typeof value === "string" &&
                    value.trim()
            )
        )
    ];
}


// --------------------------------------------------
// DOES ONE ASSERT HOLD FOR ONE DECLARATION
// --------------------------------------------------
// Every clause in it must pass against that declaration's own facts. A
// clause verify cannot evaluate counts as not holding: an assert that errors
// is not evidence the two declarations are the same behaviour.
// --------------------------------------------------

function assertHolds(
    assertion,
    facts
) {
    const clauses =
        Object.entries(
            assertion || {}
        );

    // getEvolutionFacts returns { file, kind, properties }, and
    // evaluateClause reads the fact fields themselves. Passing the wrapper
    // made every field "not present in the current facts", so every clause
    // errored, so no assert ever held and every merge the model proposed
    // was refused - twenty-one of them in one measured run, silently
    // correct-looking because a refusal splits rather than fails.
    const fields =
        facts?.properties &&
        typeof facts.properties === "object"
            ? facts.properties
            : facts;

    if (
        clauses.length === 0 ||
        !fields
    ) {
        return false;
    }

    return clauses.every(
        ([field, clause]) => {
            const result =
                evaluateClause(
                    field,
                    clause,
                    fields,
                    null
                );

            return result?.pass === true;
        }
    );
}


// --------------------------------------------------
// THE MERGE GATE
// --------------------------------------------------
// Returns the groups of declarations to draw as nodes: one group holding all
// of them when the merge holds, or one group each when it does not.
//
// The gate is PlanMap's own verification primitive. If a single assert is
// true of every declaration, they are the same claim by the definition the
// rest of the system already uses; if no assert is, they are different
// behaviours whatever they look like.
// --------------------------------------------------

function mergeGroups(
    identities,
    rules,
    factsByIdentity,
    dropped
) {
    const split = () =>
        identities.map(
            identity => [identity]
        );

    if (
        identities.length < 2
    ) {
        return [identities];
    }

    const shared =
        rules.some(
            rule =>
                identities.every(
                    identity =>
                        assertHolds(
                            rule.assert,
                            factsByIdentity[identity]
                        )
                )
        );

    if (!shared) {
        dropped.push(
            `${identities[0]}: merged with ${identities.length - 1} other declaration(s) ` +
            "without one assert true of all of them, so they were drawn separately"
        );

        return split();
    }

    return [identities];
}


// --------------------------------------------------
// NORMALIZE BROWNFIELD OUTPUT
// --------------------------------------------------
// 1-Adds PlanMap-owned fields.
// 2-Rejects malformed batches.
// 3-Ensures every rule targets its declaration.
// --------------------------------------------------

// --------------------------------------------------
// A READING MUST BE ABOUT ITS OWN STEP
// --------------------------------------------------
// Two things the prompt asks for and cannot guarantee, enforced here. A
// reading that fails either is removed, and the node falls back to its own
// title in that lens - which is what a missing reading already does, and is
// honest: the perspective had nothing of its own to say at this step.
//
// A title cannot fall back to anything, so a title that opens with a
// placeholder verb is reported rather than removed. It is left for the
// reader to revise.
//
// The prompt asks for readings that no neighbouring step could borrow, and
// on a good run that is what comes back. On a bad one a lens falls into a
// stock phrase - "Nothing is read or written" arrived twelve times in one
// draft - and twelve nodes then look like one node repeated, which is the
// single thing the plan graph most needs to avoid.
//
// A prompt cannot hold a uniqueness constraint across a whole response, so
// this enforces it. The first node to use a line keeps it; every later node
// loses it and falls back to its own title in that lens, which is already
// what a missing reading does. A title is unique per node, so the reader
// still sees a distinguishable line - it has simply stopped pretending the
// perspective had something of its own to say.
// --------------------------------------------------

// Words that stand in for a verb nobody chose. The prompt bans them in
// three places; roughly one line in twenty still opens with one.
const PLACEHOLDER_VERBS =
    /^(handle|process|manage|execute|perform|run|do|support|implement|ensure|deal with|take care of)\b/i;

// A reading that opens by saying what is NOT true. Always grammatically
// valid, always sounds like an answer, and is true of most steps in most
// features - which is exactly why it teaches a reader nothing. The correct
// way to say "this lens has nothing of its own to add" is to leave the key
// out, not to write a sentence that says so. Matches only "No", "Not", "None",
// "Nothing" — not "Anyone"/"Nobody" which can be parts of grounded readings
// like "Anyone holding the booking may print it".
const NEGATIVE_FILLER =
    /^(no|not|none|nothing)\b/i;

export function dropRepeatedReadings(
    nodes,
    dropped = []
) {
    const seen =
        new Map();

    for (
        const node of nodes
    ) {
        if (
            !node?.readings
        ) {
            continue;
        }

        if (
            PLACEHOLDER_VERBS.test(String(node.title || "").trim())
        ) {
            dropped.push(
                `${node.identity || node.id}: title "${node.title}" opens with a placeholder verb - say what happens to the object`
            );
        }

        for (
            const [lensId, reading] of Object.entries(node.readings)
        ) {
            if (
                PLACEHOLDER_VERBS.test(String(reading).trim())
            ) {
                delete node.readings[lensId];

                dropped.push(
                    `${node.identity || node.id}: dropped ${lensId} reading "${reading}" - opens with a placeholder verb`
                );

                continue;
            }

            if (
                NEGATIVE_FILLER.test(String(reading).trim())
            ) {
                delete node.readings[lensId];

                dropped.push(
                    `${node.identity || node.id}: dropped ${lensId} reading "${reading}" - negative filler, not a reading; omit the key instead`
                );

                continue;
            }

            const key =
                `${lensId}::${String(reading).trim().toLowerCase().replace(/[.\s]+$/, "")}`;

            if (
                seen.has(key)
            ) {
                delete node.readings[lensId];

                dropped.push(
                    `${node.identity || node.id}: dropped ${lensId} reading "${reading}" - already used by ${seen.get(key)}`
                );

                continue;
            }

            seen.set(
                key,
                node.identity || node.id
            );
        }
    }

    return nodes;
}


export function normalizeBrownfieldNodes(
    parsed,
    plan,
    candidates,
    dropped = [],
    skipped = [],
    lensesByIdentity = {},
    stageByIdentity = {},
    factsByIdentity = {},
    roleByIdentity = {}
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

        // One node may stand for several declarations - see the merge
        // gate below. "identity" is the first of them and stays the node's
        // own, so everything downstream that names a single declaration
        // keeps working on an unmerged plan exactly as it did.
        const identities =
            draftIdentities(draft);

        if (
            identities.length === 0 ||
            identities.some(
                value =>
                    !candidateIdentities.has(value)
            )
        ) {
            throw new Error(
                "not one of the declarations it was asked about"
            );
        }

        const identity =
            identities[0];

        // A declaration a person has ruled on keeps the node they ruled on.
        // Merging it into a new one would move their decision onto a claim
        // they never read, so the whole draft node stands aside.
        if (
            identities.some(
                value =>
                    protectedIdentities.has(value)
            )
        ) {
            continue;
        }

        if (
            typeof draft.title !== "string" ||
            !draft.title.trim()
        ) {
            throw new Error(
                `Brownfield draft for ${identity} has no title.`
            );
        }

        if (
            typeof draft.intent !== "string" ||
            !draft.intent.trim()
        ) {
            throw new Error(
                `Brownfield draft for ${identity} has no intent.`
            );
        }

        if (
            !Array.isArray(
                draft.rules
            ) ||
            draft.rules.length === 0
        ) {
            throw new Error(
                `Brownfield draft for ${identity} must contain behaviour rules.`
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
                identity
            ]?.length
                ? lensesByIdentity[
                    identity
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
                            `Brownfield draft for ${identity} contains an invalid rule.`
                        );
                    }

                    if (
                        rule.kind !==
                        "behaviour"
                    ) {
                        throw new Error(
                            `Brownfield draft for ${identity} contains a non-behaviour rule.`
                        );
                    }

                    if (
                        !identities.includes(
                            rule.target
                        )
                    ) {
                        throw new Error(
                            `Brownfield rule target does not match ${identity}.`
                        );
                    }

                    if (
                        !rule.assert ||
                        typeof rule.assert !== "object"
                    ) {
                        throw new Error(
                            `Brownfield draft for ${identity} contains an invalid assertion.`
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
                                            `${identity}: ${problem}`
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
                            identity,

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
                    identity
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
                `Brownfield draft for ${identity} contains an unknown feature.`
            );
        }

        // What this declaration is FOR, which decides how it is drawn. The
        // model's answer wins where it named one PlanMap knows; the facts'
        // own proposal is the fallback, and a step is the fallback to that,
        // because that is what every node was before roles existed.
        const role =
            canonicalRole(
                draft.role
            ) ||
            roleByIdentity[identity] ||
            DEFAULT_ROLE;

        // --------------------------------------------------
        // THE MERGE GATE
        // --------------------------------------------------
        // Several declarations are one step only when one assert is true of
        // all of them. Checked here against the same facts verify will use,
        // rather than trusted: "they look similar" is exactly the judgement
        // a model makes loosely, and a wrong merge hides a declaration
        // behind a claim that was never about it.
        //
        // A merge that fails is not thrown away - it is split back into one
        // node per declaration and reported. Dropping it would lose every
        // declaration in it from the plan, which is the one outcome worse
        // than an over-eager merge.
        // --------------------------------------------------
        const groups =
            mergeGroups(
                identities,
                rules,
                factsByIdentity,
                dropped
            );

        const dimensions =
            Array.isArray(draft.dimensions)
                ? draft.dimensions
                    .filter(
                        entry =>
                            typeof entry === "string" &&
                            entry.trim()
                    )
                    .map(
                        entry =>
                            entry.trim()
                    )
                : [];

        for (
            const group of groups
        ) {
            const primary =
                group[0];

            const node = {
                id:
                    createId(
                        "plan",
                        nodeNumber++
                    ),

                feature:
                    featureId,

                identity:
                    primary,

                // Only written when the node really does stand for several
                // declarations, so an unmerged plan is byte-identical to
                // one drafted before merging existed.
                ...(group.length > 1
                    ? { identities: [...group] }
                    : {}),

                ...(group.length > 1 && dimensions.length
                    ? { dimensions }
                    : {}),

                role,

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

                // Every declaration the node stands for carries every
                // assert, so verify checks the claim against all of them
                // rather than against whichever one happened to be first.
                rules:
                    group.flatMap(
                        target =>
                            rules.map(
                                rule => ({
                                    kind: "behaviour",
                                    target,
                                    assert: rule.assert
                                })
                            )
                    ),

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
        }
      } catch (error) {
        skipped.push(
            `${typeof draft?.identity === "string" ? identity : "unnamed node"}: ${error.message}`
        );
      }
    }


    // --------------------------------------------------
    // FAIL CLOSED WHEN THE RESPONSE IS BROADLY WRONG
    // --------------------------------------------------
    // An isolated mistake is skipped and reported above. A response that is
    // mostly wrong is not a draft, and nothing is written.
    // --------------------------------------------------

    // --------------------------------------------------
    // COVERAGE
    // --------------------------------------------------
    // A declaration that reached no node is gone from the plan, and nothing
    // above would have said so: the model simply did not mention it. That
    // was survivable while one node meant one declaration, because an
    // omission was a missing node. Now that a node may stand for several,
    // a model that merges four declarations in its head and lists one
    // identity loses three of them silently - so the count is checked here
    // rather than trusted.
    // --------------------------------------------------

    const covered =
        new Set(
            nodes.flatMap(
                node =>
                    Array.isArray(node.identities)
                        ? node.identities
                        : [node.identity]
            )
        );

    const missing =
        [...candidateIdentities].filter(
            identity =>
                !covered.has(identity) &&
                !protectedIdentities.has(identity)
        );

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

    // Reported after the fail-closed check, and never counted into it. A
    // response that is malformed is not a draft and nothing is written; a
    // response that is merely incomplete still carries every node it did
    // get right, and throwing those away to protest the gap would cost the
    // reader more than the gap does. So it is said plainly instead.
    for (
        const identity of missing
    ) {
        skipped.push(
            `${identity}: the draft never mentioned it, so it has no node`
        );
    }

    return nodes;
}


// --------------------------------------------------
// LINK EACH FEATURE'S STEPS
// --------------------------------------------------
// An edge says "this leads to that". It used to be drawn between every step
// and the next one the model numbered, which made each feature a single
// unbranching line: 178 edges over 179 nodes in one measured project, with
// four sibling lookups drawn as though one caused the next.
//
// Now an edge is drawn only where one step's code calls another's. Where the
// code shows nothing, nothing is drawn, and the steps sit as what they are -
// things this feature does, in no forced order.
//
// The model's step number is kept instead of deleted. It is a reading order,
// which is a weaker claim than an arrow and a useful one: the feature still
// reads top to bottom in the order a person meets it, while only the real
// relationships are drawn as relationships.
// --------------------------------------------------

export function linkFeatureSteps(
    nodes,
    callGraph = null
) {
    // Which node owns which declaration, across the WHOLE plan rather than
    // one feature at a time. A call is real regardless of which feature its
    // target ended up in, and scoping this to one feature at a time was the
    // only reason a genuine cross-feature relationship could never be
    // drawn: the identity of a step in another feature was simply not in
    // the map yet. A merged node owns all of the declarations it stands
    // for.
    const nodeByIdentity =
        new Map();

    for (
        const node of nodes
    ) {
        for (
            const identity of nodeIdentities(node)
        ) {
            nodeByIdentity.set(
                identity,
                node.id
            );
        }
    }

    for (
        const node of nodes
    ) {
        const targets =
            new Set();

        for (
            const identity of nodeIdentities(node)
        ) {
            const calls =
                callGraph?.callees?.get(
                    identity
                );

            for (
                const called of calls || []
            ) {
                const target =
                    nodeByIdentity.get(called);

                // Not the node itself: a merged node calling its own other
                // declaration is one step, not a step leading to itself.
                // Same feature or a different one, it is drawn either way -
                // that is what makes this the one place a genuine
                // cross-feature relationship can surface at all.
                if (
                    target &&
                    target !== node.id
                ) {
                    targets.add(target);
                }
            }
        }

        node.edgesOut =
            [...targets];
    }

    return nodes;
}


// Every declaration a node stands for. One for an ordinary node, several
// for a merged one.
function nodeIdentities(
    node
) {
    if (
        Array.isArray(node?.identities) &&
        node.identities.length > 0
    ) {
        return node.identities;
    }

    return typeof node?.identity === "string"
        ? [node.identity]
        : [];
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

    // The plan's features are the outline's capabilities, and nothing else.
    //
    // This used to promote each capability's first headings into features of
    // their own, because the Constellation was the only level there was and
    // two enormous features drew two boxes and explained nothing. The middle
    // level does that job now, and doing both put the same hierarchy on two
    // levels at once: a feature's parts appeared as siblings of the feature,
    // so MPLAD's Constellation grew nodes called "Tables" and "Processors" -
    // parts of Work Records standing beside it - and the plan's feature list
    // stopped matching the outline's, which rejected 18 of 30 nodes on the
    // next draft for naming "an unknown feature".
    //
    // A heading is a part of a capability. It belongs at Level 2.

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
                        node?.origin === "human_authored" ||
                        node?.origin === "ai_edited_by_human" ||
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
    // WHO CALLS WHOM
    // --------------------------------------------------
    // Built once for the whole draft. Two things read it: the role each
    // declaration is proposed as, and the edges between the steps. Both
    // need to know whether anything in the project actually calls a
    // declaration, which no single declaration's own facts can say.
    // --------------------------------------------------

    const callGraph =
        buildCallGraph(
            baseline?.declarations || []
        );

    // Declarations that look like one behaviour written once per thing it
    // applies to. Offered to the model as merge candidates; the gate in
    // normalize decides whether any of them really are.
    const familyByIdentity =
        siblingFamilies(
            baseline?.declarations || []
        );

    const roleByIdentity =
        {};

    for (
        const declaration of baseline?.declarations || []
    ) {
        if (
            typeof declaration?.identity !== "string"
        ) {
            continue;
        }

        roleByIdentity[
            declaration.identity
        ] =
            proposeRole(
                declaration,
                callGraph.callerCount.get(
                    declaration.identity
                ) || 0,
                callGraph.callees.get(
                    declaration.identity
                )?.size || 0
            );
    }

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
                // Was 30. A batch is now bookkeeping as well as judgement -
                // every declaration has to be ticked off against a node, and
                // a node may hold several - and at thirty a measured run
                // lost 128 of 183 declarations to a model that merged in its
                // head and listed one identity. Twenty is small enough to
                // track and still large enough to see a whole feature.
                : 20;

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
                groupByIdentity,
                roleByIdentity,
                familyByIdentity
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
                stageByIdentity,
                factsByIdentity,
                roleByIdentity
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
                        // only checks approved nodes. A node they wrote or
                        // edited by hand is theirs for the same reason.
                        if (
                            node?.status === "approved" ||
                            node?.origin === "human_authored" ||
                            node?.origin === "ai_edited_by_human" ||
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
            linkFeatureSteps(
                [
                    ...preservedNodes,
                    ...nodes
                ],
                callGraph
            );

        // Across the whole plan, not per batch: each batch is its own call
        // and two of them reach for the same stock phrase readily. Preserved
        // nodes go in first, so a line a person already approved is the one
        // that keeps its place.
        dropRepeatedReadings(
            linked,
            dropped
        );

        // --------------------------------------------------
        // THE BEHAVIOURAL AREA
        // --------------------------------------------------
        // The outline already worked out which part of a feature each
        // declaration belongs to. The plan was handed that as context for
        // choosing a feature and then threw it away, so the Plan Graph had
        // no middle level to show. It is recorded here under the name the
        // outline uses, so both views read one hierarchy rather than two
        // that drift apart.
        //
        // Over every node, not just this batch's. A node a person approved
        // is preserved and never redrafted - which would have left it
        // without an area for ever. Approving a step is a decision about
        // what that step must do; it is not a decision to freeze where the
        // step sits in the feature. PlanMap owns this field, copies it from
        // the outline, and touches nothing else on a preserved node.
        // --------------------------------------------------
        for (
            const node of linked
        ) {
            const headings =
                groupByIdentity[node.identity]?.headings;

            if (
                Array.isArray(headings) &&
                headings.filter(Boolean).length > 0
            ) {
                node.path = headings.filter(Boolean);
            }
        }

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

        // Declarations, not nodes. A batch where four declarations became
        // one step has drafted all four, and counting nodes would report
        // every merge as three declarations lost.
        const coveredInBatch =
            new Set(
                nodes.flatMap(
                    node =>
                        Array.isArray(node.identities)
                            ? node.identities
                            : [node.identity]
                )
            ).size;

        if (
            coveredInBatch < batch.length
        ) {
            console.log(
                `Batch ${batches}: ${coveredInBatch} of ${batch.length} declarations drafted; the rest are retried on the next run.`
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
${BEHAVIOUR_LINE}
A greenfield plan has no facts to lean on yet, so the evidence rule reads
one step back: every content word must trace to what the brief actually
asks for. Everything else in the standard holds unchanged - the named
object, the banned phrases, the flow that reads start to finish.

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
