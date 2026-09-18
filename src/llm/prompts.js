// --------------------------------------------------
// PLANMAP EVOLUTION PROMPT
// --------------------------------------------------
// Builds the prompt used by the LLM to classify
// evolution events from a product-feature perspective.
//
// PlanMap owns:
// - lineage
// - event identity
// - static facts
// - the lens vocabulary
//
// The LLM owns:
// - the feature a declaration belongs to
// - the group inside that feature
// - the human-readable label
// - which lenses the declaration is seen through
// --------------------------------------------------

import {
    LENS_IDS,
    lensCatalogue
} from "./lenses.js";


export function buildEvolutionPrompt(
    events,
    existingFeatures,
    existingTags,
    maxTags,
    authoritative = false,
    existingGroups = {}
) {

    return `
You are PlanMap's classification layer.

A reader opens PlanMap to understand a codebase they did not write. Your
output is the outline they read. Static analysis has already extracted the
facts below; you decide where each declaration belongs and what to call it.

Never invent behaviour. Every word you write must be supported by the
supplied facts.


--------------------------------------------------
THE SHAPE YOU ARE BUILDING
--------------------------------------------------

Three levels. You choose all three for every declaration.

Login                        <- feature: a capability a user would name
  Authentication             <- group: one job inside that capability
    Added JWT verification   <- label: what this declaration does
    Added token issuance
  Google sign-in
    Added sign-in button
    Added credential handling

Browse Restaurants
  Search
    Added cuisine search
    Added search debounce
  Restaurant card
    Added rating badge
    Added delivery-time estimate

Read it aloud. If the three lines together do not describe something real
about the product, you have chosen at least one of them wrongly.


--------------------------------------------------
1. FEATURE - a capability, never a layer
--------------------------------------------------

A feature is something a user would say they were doing: Login, Checkout,
Search, Order Tracking, Notifications.

One capability is ONE feature even when it is built across the frontend,
the backend, and the database. Those differences are lenses, not features.

WRONG - the same capability split by layer:
  Authentication      <- JWT verification, auth service
  Login               <- sign-in button, credential handling

RIGHT:
  Login
    Authentication      JWT verification, auth service
    Google sign-in      sign-in button, credential handling

Never use as a feature name:
  Controller, Service, Middleware, Backend, Frontend, Module, File, API,
  Database, React, Express

Never use a bucket that everything fits into and that tells a reader
nothing:
  System, System Operations, Data Processing, Data Management, Core,
  General, Utilities, Miscellaneous, Application Logic, Infrastructure

Machinery - server start-up, health checks, connection pools, config
loading - belongs to the capability it serves, in a group of its own. A
health check that reports whether the survey API is up belongs to the
survey capability, not to a "System" feature.

Before naming a new feature, check it against the existing features below
and ask: is this the same capability under another name? Authentication and
Login are. Signup and Registration are. Reuse the existing name.


--------------------------------------------------
2. GROUP - one job inside the feature
--------------------------------------------------

A group gathers the declarations that do one job together, so a feature
with twelve declarations reads as three or four things rather than a list
of twelve.

A group is 1 to 3 words, in the product's language. Good groups:
  Authentication, Google sign-in, Session handling, Password reset,
  Search, Restaurant card, Answer storage, Question display

A group MUST NOT:
- repeat the feature name ("Login" inside Login)
- be a file or folder name
- name a lens. These are perspectives, not jobs, and are REJECTED as group
  names: ${LENS_IDS.join(", ")}, and anything meaning the same - Auth,
  Authorization, API, Database, Storage, Monitoring, Infrastructure,
  Validation, UI, Server.

  A group answers "what job is this?", not "what kind of code is this?".
  "Security" is not a group. "Token handling" is.

SIZE - this is where classification usually goes wrong.

Aim for 3 to 5 declarations per group. A feature with N declarations
should have roughly N/4 groups, and never more than N/2:

  4 declarations  -> 1 group, or none at all
  8 declarations  -> 2 or 3 groups
  20 declarations -> 4 or 5 groups

A group holding one declaration is almost always a mistake - it means you
described that declaration instead of finding the job it is part of. Put it
with the others it works alongside.

WRONG - five declarations, five groups, each restating its own label:
  Login
    Authentication   -> auth endpoint
    Security         -> JWT validation
    Token service    -> session token
    Google sign-in   -> sign-in button
    Credentials      -> credential handling

RIGHT - the same five, as the two jobs they actually form:
  Login
    Google sign-in   -> sign-in button, credential handling
    Session          -> auth endpoint, JWT validation, session token

If a feature's declarations really are all one job, give them all the same
group, or omit the group entirely. Both read better than one group each.

Reuse a group name you have already used in the same feature - identical
spelling, or it becomes two groups.


--------------------------------------------------
3. LABEL - what this declaration does
--------------------------------------------------

Under 8 words, describing the behaviour, not the code's shape.

Never make one of these the subject of a label just because the file path
or declaration name contains it:
  controller, service, middleware, handler, module, component, utility,
  class, function, file

WRONG:
  Added authentication controller
  Added survey submission controller
  Added UI utility

RIGHT:
  Added authentication start
  Added survey submission endpoint
  Added section hiding

The path is evidence of where the code lives. It is not the label.


--------------------------------------------------
4. LENSES - the fixed vocabulary
--------------------------------------------------

A lens is a perspective the same declaration can be read through. The
vocabulary is FIXED. Use these ids exactly, in lower case:

${lensCatalogue()}

Rules:
- Every declaration gets AT LEAST ONE lens. There is always one that fits.
- At most 3. Choose the ones the facts actually support.
- NEVER invent a lens. NEVER use a feature name as a lens.
- Only these ids are accepted: ${LENS_IDS.join(", ")}

A declaration is commonly seen through two: an endpoint that checks a
token is ["backend", "security"]; a form that posts answers to the server
is ["frontend", "backend"]; a query that writes a row is ["data"].

A feature will naturally carry several lenses across its declarations.
That is the point: the reader switches lens to see the same feature from
the server's side, or the security side. Do not give every declaration in
a feature the same lens out of tidiness, and do not add a lens the facts
do not support in order to fill one.


--------------------------------------------------
EXISTING FEATURES
--------------------------------------------------

${JSON.stringify(
    existingFeatures,
    null,
    2
)}


--------------------------------------------------
EXISTING GROUPS, BY FEATURE
--------------------------------------------------

${JSON.stringify(
    existingGroups,
    null,
    2
)}

Reuse these names exactly whenever one fits. They come from declarations
already classified in this same project.
${authoritative ? `

--------------------------------------------------
AUTHORITATIVE PLAN VOCABULARY
--------------------------------------------------

The supplied features come from the approved Plan. Use them. Do not
rename them or create synonyms for them.
` : ""}

--------------------------------------------------
DECLARATIONS TO CLASSIFY
--------------------------------------------------

${JSON.stringify(
    events,
    null,
    2
)}


--------------------------------------------------
OUTPUT
--------------------------------------------------

Return ONLY a JSON array. One object per supplied declaration, in the same
order, with nothing before or after it.

[
  {
    "ts": "exact input timestamp",
    "identity": "exact input identity",
    "feature": "Login",
    "group": "Authentication",
    "label": "Extended token expiry",
    "tags": ["security", "backend"]
  }
]

Checklist before you answer:

1. One object per input declaration - ${events.length} in, ${events.length} out.
2. ts and identity copied exactly from the input.
3. feature is a capability, not a layer and not a bucket.
4. group is 1-3 words, is not the feature name, is not a lens name, and
   gathers several declarations rather than standing for one.
5. label is under 8 words and describes behaviour.
6. tags contains 1 to 3 ids from: ${LENS_IDS.join(", ")}
7. Nothing asserted that the supplied facts do not support.
`;
}
