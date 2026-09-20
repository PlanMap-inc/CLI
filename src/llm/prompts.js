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

// One standard for every human-readable line PlanMap generates. An outline
// label says what HAPPENED rather than what the code does, but the sentence
// underneath it is built the same way: a real verb and a named object.
import { BEHAVIOUR_LINE } from "./behaviour.js";


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

An outline. Every declaration gets a feature, a label, and however many
headings belong between them - none, one, or several. The depth is yours,
and it comes from the code, not from a rule.

Login                        <- feature: a capability a user would name
  Sign in                    <- a heading: one job inside that capability
    Google                   <- a heading inside that, where it helps
      Added sign-in button   <- label: what happened to this declaration
      Added credential handling
    Email
      Added address validation
      Added magic link
  Tokens                     <- one level is enough here
    Added JWT verification
    Added token issuance
    Added refresh

Browse Restaurants
  Search
    Added cuisine search
    Added search debounce
  Restaurant card            <- and none at all is fine too
    Added rating badge

"Sign in" divides because Google and Email are genuinely different ways in.
"Tokens" does not, because its three declarations do one job. Read your
outline aloud: every line should say something real about the product, and
no line should exist only to hold one other line.

Each declaration you are given carries a "type" - added, changed or deleted
- and a changed one also carries "changed": plain sentences saying exactly
what moved. Those sentences are the whole point of a changed entry. Use
them.


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

A feature is a STAGE OF THE JOURNEY, not a whole half of the product.

The Constellation draws one node per feature and joins them in order, so
read together they should be the path a person walks:

  Sign in -> Start the survey -> Answer the questions -> Submit -> Confirmed

Two enormous features ("Login", "Survey") draw two boxes and explain
nothing. Where a capability's declarations span several things a person does
one after another, name those stages as separate features.

A stage must own at least one declaration. Never invent one to pad the
journey, and never split where the code shows no separate step.

Never use as a feature name:
  Controller, Service, Middleware, Backend, Frontend, Module, File, API,
  Database, React, Express, Server

Never use a bucket that everything fits into and that tells a reader
nothing:
  System, System Operations, Data Processing, Data Management, Core,
  General, Utilities, Miscellaneous, Application Logic, Infrastructure

Machinery - server start-up, health checks, connection pools, config
loading - belongs to the capability it SERVES, under a heading of its own.
Ask what stops working if it fails. A server that serves the survey API
belongs to the survey capability; a health check reporting on it belongs
there too. Neither belongs to a "System" feature, and neither belongs to
whichever capability happens to be listed first.

When a piece of machinery serves every capability equally and no single one
owns it more than the rest - a server that starts once and then serves every
route alike - attach it to the FIRST capability in the journey, the one a
person reaches before any other. That is a real fact about the journey, not
a guess, and it beats inventing a capability whose only members are
plumbing: a "Server" feature holding nothing but start-up and a health
check is exactly this mistake, seen in a real project's own output.

Before naming a new feature, check it against the existing features below
and ask: is this the same capability under another name? Authentication and
Login are. Signup and Registration are. Reuse the existing name.


--------------------------------------------------
2. PATH - the headings a declaration sits under
--------------------------------------------------

"path" is a list of headings between the feature and this declaration. You
choose how many. One is common, two is often clearer, three is right when a
part of the project really does divide that far. There is no limit and no
required number.

  "feature": "Login", "path": ["Sign in"]
  "feature": "Login", "path": ["Sign in", "Google"]
  "feature": "Login", "path": ["Sign in", "Google", "Token exchange"]

Let the code decide. Add a level when it separates things a reader would
otherwise have to tell apart by squinting at labels:

  Login
    Sign in
      Google          sign-in button, credential handling
      Email           address validation, magic link
    Tokens
      Verify JWT, sign token, refresh

Here "Sign in" splits because Google and Email are genuinely different ways
in. "Tokens" does not split, because its three declarations do one job. Both
decisions came from the code, not from a rule about depth.

A heading MUST NOT:
- repeat the feature name, or the heading directly above it
- name a layer or a lens. These are perspectives, already carried by tags,
  and are REJECTED as headings: ${LENS_IDS.join(", ")}, frontend, backend,
  ui, api, database, security, platform, integration, middleware,
  controller, service
- be a file or folder name
- be a bucket anything fits in: Utilities, Helpers, Core, General, Common,
  Shared, Misc, Operations, Management, Handling, Processing, Logic,
  Setup, Main, Details, Directory, Tables, Processors, Workflow, Records
- END in a structural word. The last word of an English noun phrase is its
  head, so "Report API" is an API and "Risk Service" is a service - both name
  a layer with a topic attached. Reject a heading ending in: API, Service,
  Controller, Handler, Manager, Module, Component, Layer, Utils, Helpers,
  Tables, Models, Views, Routes, Endpoints.

  WRONG              RIGHT
  Report API         Report delivery
  Records API        Record lookup
  Setup              Server start-up
  Main               whatever it actually does
  Details            Finding detail
  Directory          Staff lookup
  Tables             Table rendering
  Processors         Record processing

  Those eight are real headings this prompt has produced. Each one named
  where the code lives or admitted nothing was decided. A heading names a
  RESPONSIBILITY: what part of the feature's work happens here.

Each heading is 1 to 3 words, in the product's language.

SIZE - this is where classification usually goes wrong.

A heading exists to gather several things. A heading with ONE declaration
under it restates that declaration and is dropped when the graph is drawn,
so it costs you a level and gains nothing. Before adding a level, check that
at least two things will sit under it.

That is the only limit. Where a heading itself holds several distinguishable
jobs, nest again - two, three and four levels are all normal, and a deeper
outline explains a project better than a flat one. Reach for the second and
third level whenever the things under a heading fall into groups of their
own.

WRONG - five declarations, five headings, each restating its own label:
  Login
    Authentication   -> auth endpoint
    Security         -> JWT validation
    Token service    -> session token
    Google sign-in   -> sign-in button
    Credentials      -> credential handling

RIGHT - the same five, as the two jobs they form:
  Login
    Sign in          -> sign-in button, credential handling
    Tokens           -> auth endpoint, JWT validation, session token

If a feature's declarations really are all one job, give them all the same
single heading, or an empty path. Both read better than one heading each.

Be consistent within a feature. Either every declaration in it has a
heading, or none does. A feature where four declarations sit under headings
and five float loose beside them reads as a job left half done - and the
loose ones look like leftovers rather than the capability's own work. If you
head any of them, head all of them.

Reuse a trail you have already used - identical spelling at every level, or
it becomes a second heading beside the first.


--------------------------------------------------
3. LABEL - what happened, not what the code is
--------------------------------------------------

This is the line a reader scans to understand the project's story. It says
what HAPPENED to the product. It is not a description of the declaration.

Each declaration carries a "type", and the three take different labels.

type "added" - this declaration did not exist before.
  The label names the capability that arrived.
    Added Google sign-in button
    Added survey submission endpoint

type "deleted" - it is gone.
    Removed the old password reset

type "changed" - it existed, and something about it moved. THE LABEL MUST
DESCRIBE THE MOVEMENT. Read the "changed" lines supplied with the event;
they say exactly what differs. Then say what that means for the product.

  WRONG - describes the declaration, which is what it did before as well,
  so a reader learns nothing about what happened:
    Shows question and hides sections
    Handles survey submission
    Validates the token

  RIGHT - describes the change:
    changed: "8 returns became 9 returns (1 more)"  on showQuestion
      -> Added a ninth survey question
    changed: "0 throws became 2 throws (2 more)"  on submitSurvey
      -> Started rejecting bad submissions
    changed: "now calls \"bcrypt.compare\"; no longer calls \"=== \""
      -> Switched to hashed password checks
    changed: "3 parameters became 2 parameters (1 fewer)"
      -> Dropped an argument from the survey call

  Read the change together with the declaration's name and its feature. A
  function called showQuestion that gains one more return path, in a feature
  called Survey, is one more question. Say that.

  Always try the product reading FIRST. Ask: someone using this product,
  who has never seen the code - what would they notice? One more return in
  showQuestion is one more question they answer. A new throw in a submit
  path is a submission they now get turned away for. Name that.

  "Added one more return path" is a last resort, not a default. Reach for
  it only when the change genuinely carries no product meaning - a renamed
  internal variable, a refactor that moves code without changing what
  happens. Even then it beats describing what the declaration does, which
  was equally true before the change and tells a reader nothing.

Under 8 words, always.

HOW THE LABEL IS BUILT

A label opens with what happened - Added, Removed, or the movement itself -
and the rest of it is a behaviour line: a real verb and a NAMED object.
${BEHAVIOUR_LINE}
Applied to labels, that means the object of "Added" is never a mechanism:

  WRONG                        RIGHT
  Added request handling       Added the survey submission endpoint
  Added data processing        Added the nine-question survey order
  Added response handling      Added the 409 reply for a repeat submission
  Removed the old logic        Removed the unhashed password check

A declaration of kind "data" is a named list or table. Its label says what
the list is for and how much is in it - "Added the nine-question survey
order", "Added the route table" - not that a constant exists.

Never make one of these the subject of a label because the file path or the
declaration name contains it:
  controller, service, middleware, handler, module, component, utility,
  class, function, file

WRONG:                        RIGHT:
  Added authentication controller   Added authentication start
  Added survey submission controller   Added survey submission endpoint
  Added UI utility                Added section hiding

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
EXISTING HEADINGS, BY FEATURE
--------------------------------------------------

${JSON.stringify(
    existingGroups,
    null,
    2
)}

Written as trails, "Sign in > Google" meaning "Google" nested inside
"Sign in". Reuse them exactly whenever one fits, and nest inside one rather
than making a sibling. They come from declarations already classified in
this same project.
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
    "path": ["Sign in", "Google"],
    "label": "Extended token expiry",
    "tags": ["security", "backend"]
  }
]

Checklist before you answer:

1. One object per input declaration - ${events.length} in, ${events.length} out.
1a. No two declarations share a label. They are different things and a
    reader must be able to tell them apart. If two labels come out the
    same, say what makes each one different.
2. ts and identity copied exactly from the input.
3. feature is a capability, not a layer and not a bucket.
4. every heading in path is 1-3 words, is not the feature name, the
   heading above it, a lens or a layer, and gathers several declarations
   rather than standing for one. Depth is yours to choose.
5. label is under 8 words. For a "changed" declaration it describes what
   the supplied "changed" lines say moved, never what the declaration does.
6. tags contains 1 to 3 ids from: ${LENS_IDS.join(", ")}
7. Nothing asserted that the supplied facts do not support.
`;
}
