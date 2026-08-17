// --------------------------------------------------
// PLANMAP LLM CLASSIFICATION MODULE
//
// 1-Connects PlanMap to OpenRouter.
// 2-Uses Gemini 2.5 Flash.
// 3-Receives static PlanMap facts.
// 4-Classifies changes into PRODUCT FEATURES.
// 5-Generates human-readable labels.
// 6-Generates technical tags.
// 7-Enforces a project-wide tag vocabulary cap.
// 8-Never creates the evolution hierarchy.
// 9-Validates every LLM response.
// --------------------------------------------------

import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// LOAD OPENROUTER API KEY
// --------------------------------------------------

function loadOpenRouterApiKey() {

    if (
        process.env.OPENROUTER_API_KEY
    ) {
        return process.env.OPENROUTER_API_KEY.trim();
    }


    const envPath =
        path.resolve(
            process.cwd(),
            ".env"
        );


    if (
        !fs.existsSync(
            envPath
        )
    ) {
        return null;
    }


    const envText =
        fs.readFileSync(
            envPath,
            "utf8"
        );


    const lines =
        envText.split(/\r?\n/);


    for (
        const line
        of lines
    ) {

        const trimmed =
            line.trim();


        if (
            trimmed.startsWith(
                "OPENROUTER_API_KEY="
            )
        ) {

            const value =
                trimmed
                    .slice(
                        "OPENROUTER_API_KEY=".length
                    )
                    .trim()
                    .replace(
                        /^["']|["']$/g,
                        ""
                    );


            if (
                value
            ) {
                return value;
            }
        }
    }


    return null;
}


// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const OPENROUTER_MODEL =
    "google/gemini-2.5-flash";


const OPENROUTER_ENDPOINT =
    "https://openrouter.ai/api/v1/chat/completions";


// --------------------------------------------------
// BUILD EVOLUTION PROMPT
//
// IMPORTANT:
//
// The LLM classifies the FEATURE.
// PlanMap itself owns lineage.
//
// This prevents the LLM from turning:
// Controller / Service / Middleware
// into the visible hierarchy.
// --------------------------------------------------

function buildEvolutionPrompt(
    events,
    existingFeatures,
    existingTags,
    maxTags
) {

    return `
You are PlanMap's product-feature classification layer.

Your job is ONLY to interpret facts already extracted by static analysis.

Your output must describe SOFTWARE EVOLUTION FROM A PRODUCT/FEATURE PERSPECTIVE.

The desired structure is:

Browse Restaurants
  Added cuisine search
    Added debounce
  Added distance sorting
  Restaurant card
    Added rating badge
    Added delivery-time estimate

Login
  Added JWT auth
    Fixed expiry bug
    Added refresh tokens
  Added email validation
  Improved response time

Cart
  Add / remove items

IMPORTANT:

FEATURE
= a user-facing capability or product area.

LABEL
= the concrete change represented by this evolution event.


--------------------------------------------------
LABEL QUALITY RULE
--------------------------------------------------

Labels describe the PRODUCT BEHAVIOR or USER-RELEVANT CHANGE represented
by the event.

Labels MUST NOT expose the source-code architecture merely because the
identity contains an architectural filename or declaration type.

NEVER use these implementation-role words as the main noun of a label
when describing an ordinary product change:

controller
service
middleware
handler
module
component
utility
class
function
file

Examples:

WRONG:
Added authentication controller
Added survey start controller
Added survey submission controller
Added authentication service
Added UI utility

PREFER behavior-oriented labels:

Added authentication start
Added survey start endpoint
Added survey submission endpoint
Added authentication logic
Added section hiding behavior

The label MUST be supported by the supplied event facts. Do not invent
user-facing behavior that cannot be inferred from the event.

IMPORTANT:
The source identity may contain words such as:
controllers/
services/
middleware/

Those words are technical identity metadata and MUST NOT automatically
appear in the generated label.

Architecture belongs in technical metadata/tags, not in the product
label.

A label may contain an architectural term ONLY when the actual change
being described is explicitly an architectural change. Do not infer
such a change merely from a filename.

The same rule applies to frontend implementation names. Do not turn
source names such as component, hook, utility, module, or handler into
the visible product label unless the event itself represents that
architectural concept.

Before finalizing every label, ask:

1. What actually changed?
2. Can I describe that change in terms of behavior/capability?
3. Am I accidentally copying a source-code role from the identity?
4. Is the wording supported by the supplied facts?

If the answer to question 3 is YES, rewrite the label using the
observable behavior instead.
--------------------------------------------------

CRITICAL FEATURE GROUPING RULE:

A feature represents ONE PRODUCT CAPABILITY, not one technical layer.

The same capability may be implemented across frontend, backend,
security, API, database, or other technical areas. Those implementations
MUST remain under the SAME feature when they serve the same user-facing
capability.

NEVER split one capability into separate features merely because the
implementation is in different layers.

WRONG:
Authentication
  backend authentication start
  backend JWT verification
  backend authentication service

Login
  frontend Google Sign-In
  frontend credential handling

These describe the same Login capability and MUST be grouped together.

CORRECT:
Login
  authentication start
  JWT verification
  authentication service
  Google Sign-In initialization
  credential handling

The events may have different technical tags such as:
backend, frontend, security.

Tags describe HOW or WHERE the capability is implemented.
Features describe WHAT capability exists.

Another WRONG example:

System Health
  backend health check

System Operations
  backend server startup

If both events describe the same operational capability, prefer ONE
existing capability instead of splitting it into separate features.

Before creating a new feature, ALWAYS compare the event against every
existing feature and ask:

1. Does this event belong to an existing user-facing capability?
2. Is the apparent difference only frontend vs backend?
3. Is the apparent difference only security vs frontend/backend?
4. Is the proposed feature merely a synonym or narrower implementation
   of an existing feature?

If YES, reuse the existing feature.

Do NOT create separate features named:
Authentication / Login
Signup / Registration
System Health / System Operations
Search / Search UI
Checkout / Payment Processing

when the supplied facts indicate they are parts of the same capability.

A feature is allowed and EXPECTED to contain events with mixed technical
tags. Mixed tags are evidence that the grouping is capability-oriented.

Example:

Login
  Added Google Sign-In       frontend
  Added credential handling  frontend
  Added JWT verification     backend security
  Added token validation     backend security

This is CORRECT.

Do NOT force all events in a feature to have the same tag.

--------------------------------------------------
TAG SEMANTICS
--------------------------------------------------

Tags are reusable technical filters.

A tag MUST describe a technical layer, responsibility, or concern.

Good reusable tags:
backend
frontend
security
api
database
validation
testing

Bad tag behavior:
- restating the feature name
- describing the user-facing capability
- creating a tag for one isolated event
- creating synonyms for existing tags

For example, if the feature is Login, do NOT create:
authentication

as a tag merely because the feature is authentication-related.

The feature already captures WHAT the system does.

Use technical tags such as:
frontend
backend
security
api

A tag should be reusable across multiple features whenever possible.

Do NOT spend the project-wide tag vocabulary on one-off labels such as:
monitoring
infrastructure
usability

unless the supplied project contains enough related events for that tag
to be a meaningful reusable filter.


TAGS
= reusable technical/responsibility metadata.

LINEAGE
= parent/child relationship between evolution events.

IMPORTANT FEATURE MERGING RULE:

A feature represents a capability, NOT an implementation layer.

The same capability may be implemented across frontend,
backend, API, database, security, or other technical layers.
Those layers must remain events/tags inside ONE product feature.

NEVER split one capability into separate features merely because
the implementation exists in different layers.

For example:

WRONG:
  Authentication
    JWT verification
    authentication service

  Login
    Google Sign-In
    credential handling

RIGHT:
  Login
    Google Sign-In initialization
    Added JWT authentication
    Added credential handling
    Added authentication service

The frontend and backend implementation of the same capability
belongs to the same feature.

Before creating a new feature, compare it with existing features
for semantic equivalence.

Treat obvious synonyms or closely related capability names as
the same feature when the supplied facts support that conclusion.

Examples:
  Authentication + Login -> prefer one capability
  Signup + Registration -> prefer one capability
  System Health + Health Monitoring -> prefer one capability
  Checkout + Payment Checkout -> prefer one capability

Do NOT merge unrelated capabilities merely because they occur
in the same technical layer.

The existing feature vocabulary is authoritative for continuity.

PlanMap already determines lineage.
You MUST NOT invent or modify lineage.

--------------------------------------------------
DO NOT CLASSIFY BY ARCHITECTURE
--------------------------------------------------

Do NOT use these as product features:

- Controller
- Service
- Middleware
- Backend
- Frontend
- File
- Folder
- Module
- JavaScript
- React
- Express
- API
- Database

unless the supplied facts explicitly establish that concept as a user-facing capability.

The source code path is evidence, NOT the product feature.

--------------------------------------------------
STATIC FACTS ARE THE SOURCE OF TRUTH
--------------------------------------------------

Do not invent behavior.

Do not assume functionality that is not present in the supplied facts.

Do not invent requirements.

Do not invent user-facing capabilities that are unsupported.

--------------------------------------------------
EXISTING FEATURES
--------------------------------------------------

${JSON.stringify(
    existingFeatures,
    null,
    2
)}

--------------------------------------------------
EXISTING TAGS
--------------------------------------------------

${JSON.stringify(
    existingTags,
    null,
    2
)}

--------------------------------------------------
PROJECT-WIDE TAG RULE
--------------------------------------------------

Maximum unique project-wide tags:

${maxTags}

The vocabulary must remain small.

Prefer existing tags.

Do not create synonyms.

--------------------------------------------------
NEW EVOLUTION EVENTS
--------------------------------------------------

${JSON.stringify(
    events,
    null,
    2
)}

--------------------------------------------------
OUTPUT
--------------------------------------------------

Return exactly one object for every input event.

Each object MUST contain:

{
  "ts": "exact input timestamp",
  "identity": "exact input identity",
  "feature": "product feature",
  "label": "short change description",
  "tags": ["technical", "tags"]
}

--------------------------------------------------
RULES
--------------------------------------------------

1. ts MUST exactly match the input.

2. identity MUST exactly match the input.

3. feature MUST describe a product capability.

4. Prefer an existing feature whenever it fits.

5. Do not create synonyms for existing features.

6. Keep feature names stable across sessions.

7. A feature should read naturally to a product user.

8. Good feature examples:
   Login
   Browse Restaurants
   Cart
   Checkout
   Search
   Notifications
   Profile

9. Bad feature examples:
   Controller
   Service
   Middleware
   Backend
   Frontend
   auth.controller
   survey.service

10. label MUST describe only the observed change.

11. label MUST be shorter than 8 words.

12. Use event type, delta and supplied static facts.

13. Do not invent behavior.

14. Tags are separate from the feature hierarchy.

15. Tags describe technical layers, responsibilities, or implementation concerns.

16. NEVER use a tag simply because it repeats the feature name.

17. NEVER use a tag as a synonym for the feature.

18. Prefer existing tags whenever they semantically fit.

19. Do not create near-duplicate or synonymous tags.

20. Prefer tags that can be reused across multiple unrelated product features.

21. A new tag should only be created when the supplied facts justify a
    reusable technical responsibility.

22. Avoid one-off descriptive tags that merely describe one feature,
    one endpoint, one component, or one event.

23. If an existing broader technical tag can express the same responsibility,
    reuse it instead of creating a narrower tag.

24. Each event may have 1 to 3 tags.

25. The total UNIQUE tag vocabulary across this response MUST NOT exceed ${maxTags}.

26. If the existing tag vocabulary already reaches ${maxTags}, use ONLY existing tags.

27. Never create a tag merely to fill space.

28. Feature names and technical tags are separate axes.

29. Do not spend the tag vocabulary on product-feature names,
    feature synonyms, or user-facing capability names.

21. Return ONLY valid JSON.

22. Return exactly one classification per event.

23. Do not omit events.

24. Do not duplicate events.

--------------------------------------------------
EXAMPLE
--------------------------------------------------

[
  {
    "ts": "2026-08-16T11:43:42.771Z",
    "identity": "src/auth/jwt.js::verifyToken:function",
    "feature": "Login",
    "label": "Extended token expiry",
    "tags": [
      "security"
    ]
  }
]
`;
}


// --------------------------------------------------
// EXTRACT OPENROUTER TEXT
// --------------------------------------------------

function extractOpenRouterText(
    response
) {

    const choices =
        response?.choices;


    if (
        !Array.isArray(
            choices
        ) ||
        choices.length === 0
    ) {
        return null;
    }


    const content =
        choices[0]
            ?.message
            ?.content;


    if (
        typeof content ===
        "string"
    ) {
        return content.trim();
    }


    if (
        Array.isArray(
            content
        )
    ) {

        return content
            .map(
                part =>
                    part?.text ||
                    ""
            )
            .join("")
            .trim();
    }


    return null;
}


// --------------------------------------------------
// PARSE OPENROUTER JSON
// --------------------------------------------------

function parseOpenRouterJson(
    text
) {

    if (
        !text
    ) {
        return null;
    }


    let cleaned =
        text.trim();


    cleaned =
        cleaned.replace(
            /^```json\s*/i,
            ""
        );


    cleaned =
        cleaned.replace(
            /^```\s*/i,
            ""
        );


    cleaned =
        cleaned.replace(
            /\s*```$/i,
            ""
        );


    const start =
        cleaned.indexOf(
            "["
        );


    const end =
        cleaned.lastIndexOf(
            "]"
        );


    if (
        start === -1 ||
        end === -1 ||
        end < start
    ) {
        return null;
    }


    const jsonText =
        cleaned.slice(
            start,
            end + 1
        );


    try {

        return JSON.parse(
            jsonText
        );

    } catch {

        return null;
    }
}


// --------------------------------------------------
// VALIDATE CLASSIFICATION
//
// This is the REAL enforcement layer.
//
// The LLM is not trusted to enforce the tag cap.
// PlanMap validates it here.
// --------------------------------------------------

function validateClassification(
    result,
    events,
    existingTags = [],
    maxTags = 8
) {

    if (
        !Array.isArray(
            result
        )
    ) {
        return false;
    }


    if (
        result.length !==
        events.length
    ) {
        return false;
    }


    const eventMap =
        new Map();


    for (
        const event
        of events
    ) {

        eventMap.set(
            `${event.ts}|${event.identity}`,
            event
        );
    }


    const returnedKeys =
        new Set();


    const vocabulary =
        new Set(
            existingTags
                .map(
                    tag =>
                        String(
                            tag
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(
                    Boolean
                )
                .slice(
                    0,
                    maxTags
                )
        );


    for (
        const item
        of result
    ) {

        if (
            !item ||
            typeof item !==
            "object"
        ) {
            return false;
        }


        if (
            typeof item.ts !==
            "string" ||
            typeof item.identity !==
            "string"
        ) {
            return false;
        }


        const key =
            `${item.ts}|${item.identity}`;


        if (
            !eventMap.has(
                key
            )
        ) {
            return false;
        }


        if (
            returnedKeys.has(
                key
            )
        ) {
            return false;
        }


        returnedKeys.add(
            key
        );


        if (
            typeof item.feature !==
            "string" ||
            !item.feature.trim()
        ) {
            return false;
        }


        if (
            typeof item.label !==
            "string" ||
            !item.label.trim()
        ) {
            return false;
        }


        const labelWords =
            item.label
                .trim()
                .split(/\s+/)
                .filter(
                    Boolean
                );


        if (
            labelWords.length >
            8
        ) {
            return false;
        }


        if (
            !Array.isArray(
                item.tags
            )
        ) {
            return false;
        }


        if (
            item.tags.length <
            1 ||
            item.tags.length >
            3
        ) {
            return false;
        }


        for (
            const tag
            of item.tags
        ) {

            if (
                typeof tag !==
                "string" ||
                !tag.trim()
            ) {
                return false;
            }


            const normalizedTag =
                tag
                    .trim()
                    .toLowerCase();


            if (
                !vocabulary.has(
                    normalizedTag
                )
            ) {

                if (
                    vocabulary.size >=
                    maxTags
                ) {
                    return false;
                }


                vocabulary.add(
                    normalizedTag
                );
            }
        }
    }


    return (
        vocabulary.size <=
        maxTags
    );
}


// --------------------------------------------------
// CLASSIFY EVOLUTION EVENTS
// --------------------------------------------------

export async function classifyEvolutionEvents(
    events,
    existingFeatures = [],
    existingTags = [],
    maxTags =
        Number(
            process.env.PLANMAP_MAX_TAGS ||
            8
        )
) {

    if (
        !Array.isArray(
            events
        ) ||
        events.length ===
        0
    ) {
        return [];
    }


    const apiKey =
        loadOpenRouterApiKey();


    if (
        !apiKey
    ) {
        throw new Error(
            "OPENROUTER_API_KEY is not set"
        );
    }


    const prompt =
        buildEvolutionPrompt(
            events,
            existingFeatures,
            existingTags,
            maxTags
        );


    const requestBody = {

        model:
            OPENROUTER_MODEL,

        messages: [

            {
                role:
                    "system",

                content:
                    "You are PlanMap's strict static-fact product-feature classification layer. Return only valid JSON."
            },

            {
                role:
                    "user",

                content:
                    prompt
            }

        ],

        temperature:
            0,

        max_tokens:
            2000,

        response_format: {
            type:
                "json_object"
        }

    };


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
                        "application/json",

                    "HTTP-Referer":
                        "https://planmap.dev",

                    "X-Title":
                        "PlanMap"

                },

                body:
                    JSON.stringify(
                        requestBody
                    )
            }
        );


    const responseText =
        await response.text();


    if (
        !response.ok
    ) {

        let errorMessage =
            responseText;


        try {

            const errorJson =
                JSON.parse(
                    responseText
                );


            errorMessage =
                JSON.stringify(
                    errorJson
                );

        } catch {

            // Keep original response.
        }


        throw new Error(
            `OpenRouter API request failed (${response.status}): ${errorMessage}`
        );
    }


    let responseJson;


    try {

        responseJson =
            JSON.parse(
                responseText
            );

    } catch {

        throw new Error(
            "OpenRouter returned invalid JSON"
        );
    }


    const text =
        extractOpenRouterText(
            responseJson
        );


    if (
        !text
    ) {
        throw new Error(
            "OpenRouter returned empty content"
        );
    }


    let result =
        parseOpenRouterJson(
            text
        );


    /*
     * OpenRouter can sometimes return:
     *
     * {
     *   "classifications": [...]
     * }
     *
     * instead of the array itself.
     */

    if (
        !Array.isArray(
            result
        )
    ) {

        try {

            const objectResult =
                JSON.parse(
                    text
                );


            if (
                objectResult &&
                Array.isArray(
                    objectResult.classifications
                )
            ) {

                result =
                    objectResult.classifications;
            }

        } catch {

            // Leave result invalid.
        }
    }


    if (
        !validateClassification(
            result,
            events,
            existingTags,
            maxTags
        )
    ) {

        throw new Error(
            "OpenRouter returned an invalid evolution classification"
        );
    }


    return result.map(
        item => ({
            ...item,

            // Compatibility with
            // existing evolution.json.
            category:
                item.feature,

            subcategory:
                "Feature"
        })
    );
}