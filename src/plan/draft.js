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
    readBaseline
} from "../check.js";

import {
    readEvolution
} from "../evolution/storage.js";

import {
    loadSessions
} from "../sessions.js";

import {
    getEvolutionFacts
} from "../evolution/classification.js";

import {
    getEvolutionVocabulary
} from "../evolution/classification.js";

import {
    loadOpenRouterApiKey,
    OPENROUTER_MODEL,
    OPENROUTER_ENDPOINT
} from "../llm/config.js";

import {
    extractOpenRouterText,
    parseOpenRouterJson
} from "../llm/response.js";


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
        loadOpenRouterApiKey();

    if (
        !apiKey
    ) {
        throw new Error(
            "OPENROUTER_API_KEY is not configured."
        );
    }

    return apiKey;
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

    const response =
        await fetch(
            OPENROUTER_ENDPOINT,
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
                    JSON.stringify({
                        model:
                            OPENROUTER_MODEL,

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

                        max_tokens:
                            4000
                    })
            }
        );

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
    vocabulary
) {
    const declarations =
        candidates.map(
            candidate => ({
                identity:
                    candidate.identity,

                type:
                    candidate.type,

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
- title
- intent
- lensTags
- rules

Every rule MUST have:
- kind: "behaviour"
- target
- assert

Rules must use only these checkable facts:
throws
throwTypes
returns
returnsNullish
calls
numbers
awaits
catches
emptyCatches
params

Allowed assertion operators:
>=
<=
==
!=
contains
notContains
unchanged

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

Use only supplied feature names and lens tags when they are provided.

Existing features:
${JSON.stringify(
    vocabulary.features || []
)}

Existing lens tags:
${JSON.stringify(
    vocabulary.tags || []
)}

IMPORTANT VOCABULARY BOUNDARY:
- "feature" MUST be one of the supplied existing feature names.
- "lensTags" MUST contain ONLY the supplied existing lens tag IDs.
- NEVER put a feature name into "lensTags".
- NEVER invent a lens tag.
- NEVER use a feature name such as "Login" as a lens tag unless it also appears exactly in the supplied lens tag list.

Significant declarations:
${JSON.stringify(
    declarations,
    null,
    2
)}

Return this exact top-level shape:

{
  "nodes": [
    {
      "identity": "file::name:type",
      "feature": "one of the supplied existing feature names",
      "title": "short requirement title",
      "intent": "clear behavioural intent",
      "lensTags": [],
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
    candidates
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

    const lensIds =
        new Set(
            (plan.lenses || [])
                .map(
                    lens =>
                        typeof lens?.id ===
                        "string"
                            ? lens.id
                            : ""
                )
                .filter(Boolean)
        );

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

    let nodeNumber =
        getNextNodeNumber(
            plan
        );

    for (
        const draft of parsed.nodes
    ) {
        if (
            !draft ||
            typeof draft !== "object"
        ) {
            throw new Error(
                "Brownfield LLM returned an invalid node."
            );
        }

        if (
            typeof draft.identity !== "string" ||
            !candidateIdentities.has(
                draft.identity
            )
        ) {
            throw new Error(
                "Brownfield LLM returned a node for a non-significant declaration."
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

        const lensTags =
            Array.isArray(
                draft.lensTags
            )
                ? draft.lensTags
                    .filter(
                        tag =>
                            typeof tag ===
                            "string" &&
                            tag.trim()
                    )
                    .map(
                        tag =>
                            tag.trim()
                    )
                : [];

        for (
            const tag of lensTags
        ) {
            if (
                !lensIds.has(tag)
            ) {
                throw new Error(
                    `Brownfield draft for ${draft.identity} contains unknown lens tag: ${tag}.`
                );
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

                    return {
                        kind:
                            "behaviour",

                        target:
                            draft.identity,

                        assert:
                            rule.assert
                    };
                }
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

        if (!featureId) {
            throw new Error(
                `Brownfield draft for ${draft.identity} contains an unknown feature.`
            );
        }

        nodes.push({
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
        });
    }

    return nodes;
}



// --------------------------------------------------
// BROWNFIELD FEATURE SEEDING
// --------------------------------------------------
// 1-Reuses existing plan features.
// 2-Derives new features from evolution vocabulary.
// 3-Keeps deterministic IDs.
// --------------------------------------------------

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

    const existingLensLabels =
        new Set(
            (plan.lenses || [])
                .map(
                    lens =>
                        typeof lens?.label ===
                        "string"
                            ? lens.label.trim()
                            : ""
                )
                .filter(Boolean)
        );

    const tagNames =
        Array.isArray(
            vocabulary.tags
        )
            ? vocabulary.tags
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
        const tag of tagNames
    ) {
        if (
            existingLensIds.has(tag) ||
            existingLensLabels.has(tag)
        ) {
            continue;
        }

        plan.lenses.push({
            id:
                tag,

            label:
                tag,

            source:
                "derived",

            derivedFrom:
                "evolution.tags"
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

    if (
        !Array.isArray(
            vocabulary.features
        ) ||
        vocabulary.features.length === 0
    ) {
        throw new Error(
            "Cannot draft: no features found in the evolution graph. " +
            "Run 'planmap evolution <project>' with OPENROUTER_API_KEY set to label it first."
        );
    }

    ensureBrownfieldVocabulary(
        plan,
        vocabulary
    );

    const baseline =
        readBaseline(
            projectRoot
        );

    const factsByIdentity =
        {};

    for (
        const candidate of candidates
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
        const candidate of candidates
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

    const batchSize =
        30;

    const batchesList =
        [];

    for (
        const candidatesInDirectory of
            directoryGroups.values()
    ) {
        for (
            let start = 0;
            start <
                candidatesInDirectory.length;
            start += batchSize
        ) {
            batchesList.push(
                candidatesInDirectory.slice(
                    start,
                    start + batchSize
                )
            );
        }
    }

    let drafted =
        0;

    let batches =
        0;

    for (
        const batch of batchesList
    ) {
        batches +=
            1;

        const prompt =
            buildBrownfieldPrompt(
                batch,
                factsByIdentity,
                vocabulary
            );

        const parsed =
            await callOpenRouter(
                prompt
            );

        const nodes =
            normalizeBrownfieldNodes(
                parsed,
                plan,
                batch
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

                        return (
                            node?.origin !==
                                "ai_drafted"
                        );
                    }
                );

        const nextPlan = {
            ...plan,

            nodes: [
                ...preservedNodes,
                ...nodes
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
    }

    return {
        drafted,
        batches
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
