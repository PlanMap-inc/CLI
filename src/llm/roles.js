// --------------------------------------------------
// ROLES - WHAT A DECLARATION IS DOING IN THE EXPLANATION
// --------------------------------------------------
// A lens says which perspective a declaration can be read through. A role
// says something different and more basic: what KIND of thing it is, and so
// whether it belongs in a workflow at all.
//
// Why this exists. The Plan Graph drew one node per declaration, which meant
// a feature's steps read at wildly different levels:
//
//   Verify user credentials          <- a behaviour
//   Define database configuration    <- vocabulary
//   Connect the database pool        <- machinery
//   Convert values to string         <- a tool
//
// All four are true, all four pass the behaviour-line standard in
// behaviour.js, and read together they explain nothing, because the reader
// has to sort them into these four piles by hand before the list means
// anything. Wording cannot fix that - the difference is categorical, not
// verbal. So PlanMap sorts them, and draws only the first kind as steps.
//
// The order is meaningful: it is the order a feature is read in, from the
// terms it is written in, through what must already be running, to what the
// system actually does.
// --------------------------------------------------

export const ROLES = [
    {
        id: "behaviour",
        label: "Behaviour",
        question:
            "What does the system DO here that someone could observe?",

        covers:
            "anything with a trigger and an outcome: answering a request, " +
            "checking a credential, writing a row, rendering a screen, " +
            "refusing a bad submission, sending a message",

        // What the reader is shown. Kept here rather than in the webview so
        // the prompt and the interface cannot drift about what a role means.
        shown:
            "a step on the feature's spine"
    },

    {
        id: "vocabulary",
        label: "Vocabulary",
        question:
            "What is this feature ABOUT - what are its nouns?",

        covers:
            "named lists, tables, constants, schemas, column sets, enums, " +
            "route tables, option sets - the terms the behaviours are " +
            "written in, which hold no behaviour of their own",

        shown:
            "a term listed above the spine"
    },

    {
        id: "machinery",
        label: "Machinery",
        question:
            "What must already be running for the behaviours to work?",

        covers:
            "server start-up, configuration loading, connection pools, " +
            "client construction, directory preparation, health checks - " +
            "preconditions rather than steps",

        shown:
            "a precondition listed below the spine"
    },

    {
        id: "tool",
        label: "Tool",
        question:
            "Is this a reusable helper the real steps call?",

        covers:
            "small shared utilities used from several places and carrying no " +
            "domain decision of their own: slug builders, string escapers, " +
            "formatters, type coercion",

        shown:
            "named on the steps that call it"
    }
];


export const ROLE_IDS =
    ROLES.map(
        role => role.id
    );


// A plan written before roles existed, or a node the model left unlabelled,
// is a step. That is what it was drawn as, so nothing moves on an old plan
// until it is drafted again.
export const DEFAULT_ROLE = "behaviour";


// --------------------------------------------------
// SYNONYMS
// --------------------------------------------------
// What a model reaches for when it has not read the vocabulary carefully.
// Anything unrecognised falls back to the default rather than being guessed
// at, so a stray word never becomes a fifth role.
// --------------------------------------------------

const SYNONYMS = {
    step: "behaviour",
    steps: "behaviour",
    action: "behaviour",
    operation: "behaviour",
    workflow: "behaviour",
    behavior: "behaviour",
    behaviours: "behaviour",
    behaviors: "behaviour",

    data: "vocabulary",
    constant: "vocabulary",
    constants: "vocabulary",
    schema: "vocabulary",
    schemas: "vocabulary",
    model: "vocabulary",
    type: "vocabulary",
    types: "vocabulary",
    enum: "vocabulary",
    terms: "vocabulary",
    term: "vocabulary",
    definition: "vocabulary",
    definitions: "vocabulary",

    setup: "machinery",
    config: "machinery",
    configuration: "machinery",
    bootstrap: "machinery",
    startup: "machinery",
    "start-up": "machinery",
    infrastructure: "machinery",
    infra: "machinery",
    platform: "machinery",
    plumbing: "machinery",
    lifecycle: "machinery",
    precondition: "machinery",

    helper: "tool",
    helpers: "tool",
    utility: "tool",
    utilities: "tool",
    util: "tool",
    utils: "tool",
    formatter: "tool",
    shared: "tool"
};


// --------------------------------------------------
// CANONICAL ROLE
// --------------------------------------------------

export function canonicalRole(
    value
) {
    if (
        typeof value !== "string"
    ) {
        return null;
    }

    const key =
        value
            .trim()
            .toLowerCase()
            .replace(
                /[\s_]+/g,
                "-"
            );

    if (!key) {
        return null;
    }

    if (
        ROLE_IDS.includes(key)
    ) {
        return key;
    }

    return SYNONYMS[key] || null;
}


// --------------------------------------------------
// ROLE CATALOGUE
// --------------------------------------------------
// The block the prompt embeds, so the model classifies against the same
// written definitions the interface lays out by.
// --------------------------------------------------

export function roleCatalogue() {
    return ROLES
        .map(
            role =>
                `${role.id}\n` +
                `  Asks: ${role.question}\n` +
                `  Covers: ${role.covers}\n` +
                `  Drawn as: ${role.shown}`
        )
        .join("\n\n");
}


// --------------------------------------------------
// PROPOSE A ROLE FROM THE FACTS
// --------------------------------------------------
// A starting point for the model, never the final answer. PlanMap owns the
// facts, so it says what the facts suggest; the model sees the proposal and
// the facts together and may overrule it, exactly as it may overrule the
// feature the outline proposed.
//
// Only "vocabulary" is decided outright, because kind "data" IS the fact -
// a named list holds no behaviour by construction. The other two guesses are
// shape-based and wrong often enough that the model must confirm them.
// --------------------------------------------------

// Words that name a project's plumbing wherever they appear. Matched against
// the declaration's own name, never its file path: a file called config.js
// can still hold the behaviour that reads a setting, while a function called
// createPool is machinery whatever file it lives in.
const MACHINERY_WORDS = [
    "config",
    "configure",
    "connect",
    "connection",
    "pool",
    "client",
    "bootstrap",
    "startup",
    "start",
    "init",
    "initialise",
    "initialize",
    "setup",
    "preflight",
    "listen",
    "serve",
    "mount",
    "register",
    "health",
    "ping",
    "shutdown",
    "teardown",
    "migrate"
];

// A tool is small, shared and decides nothing. Each clause is a fact rather
// than a name, because a helper is recognisable by its shape: it takes
// little, it cannot fail in a way the domain cares about, several unrelated
// places call it, and - the clause that matters most - it calls nothing of
// the project's own.
//
// That last one is what separates a helper from an orchestrator. Without it
// the test caught Store.agency_risk_for_scope and Store.findings_for_scope
// in a measured project: domain methods that happen to take two arguments
// and throw nothing. A declaration reaching into the project's own code is
// making a decision about the project, whatever its signature looks like.
const TOOL_MAX_PARAMS = 2;
const TOOL_MIN_CALLERS = 2;

export function proposeRole(
    declaration,
    callerCount = 0,
    calleeCount = 0
) {
    if (
        !declaration ||
        typeof declaration !== "object"
    ) {
        return DEFAULT_ROLE;
    }

    // A named list is vocabulary by construction: the walker records it
    // because it holds entries, and entries are terms, not steps.
    if (
        declaration.kind === "data"
    ) {
        return "vocabulary";
    }

    const facts =
        declaration.properties || {};

    const name =
        declarationName(
            declaration.identity
        );

    const words =
        splitWords(name);

    const soundsLikeMachinery =
        words.some(
            word =>
                MACHINERY_WORDS.includes(word)
        );

    // Nothing inside the project calls it and it reads as plumbing: it is
    // run by the runtime, not by a step. A declaration nothing calls that
    // does NOT read as plumbing is usually an entry point - a route handler
    // reached over HTTP - which is behaviour, so the two clauses are needed
    // together.
    if (
        soundsLikeMachinery &&
        callerCount === 0
    ) {
        return "machinery";
    }

    const throws =
        Number(facts.throws) || 0;

    const awaits =
        Number(facts.awaits) || 0;

    const params =
        Number(facts.params) || 0;

    if (
        callerCount >= TOOL_MIN_CALLERS &&
        calleeCount === 0 &&
        throws === 0 &&
        awaits === 0 &&
        params <= TOOL_MAX_PARAMS
    ) {
        return "tool";
    }

    return DEFAULT_ROLE;
}


// --------------------------------------------------
// NAME HELPERS
// --------------------------------------------------

// "api/main.py::Store.agency_risk_for_scope:method" -> "Store.agency_risk_for_scope"
export function declarationName(
    identity
) {
    if (
        typeof identity !== "string"
    ) {
        return "";
    }

    const symbol =
        identity.split("::")[1];

    if (!symbol) {
        return "";
    }

    const parts =
        symbol.split(":");

    return parts.length > 1
        ? parts.slice(0, -1).join(":")
        : symbol;
}


// "Store.agency_risk_for_scope" -> ["store", "agency", "risk", "for", "scope"]
// camelCase, snake_case, dotted and kebab all split the same way, so the
// word test works the same on a JavaScript project and a Python one.
export function splitWords(
    name
) {
    return String(name)
        .replace(
            /([a-z0-9])([A-Z])/g,
            "$1 $2"
        )
        .split(
            /[^A-Za-z0-9]+/
        )
        .map(
            word =>
                word.toLowerCase()
        )
        .filter(Boolean);
}
