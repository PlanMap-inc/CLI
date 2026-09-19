// --------------------------------------------------
// LENSES - THE PROJECT'S PERSPECTIVES
// --------------------------------------------------
// One fixed vocabulary, shared by the Evolution graph (where a lens is a
// node's tag) and the Plan Graph (where it is a node's lensTag), so the same
// declaration reads the same way in both views.
//
// The order is meaningful: both views colour a lens by its position here.
//
// Why fixed: a per-project vocabulary invented batch by batch produced
// near-synonyms (auth / security, api / backend), so a lens showed a third of
// what belonged in it and the two graphs disagreed about the same code. Six
// perspectives that every declaration can be read through cost nothing to
// classify against and mean a lens is empty only when the code really is.
// --------------------------------------------------

export const LENSES = [
    {
        id: "frontend",
        label: "Frontend",
        question:
            "What does the person see and do?",

        covers:
            "pages, screens, forms, buttons, clicks, rendering, showing and " +
            "hiding, validation messages, and anything that reads or writes " +
            "the page"
    },

    {
        id: "backend",
        label: "Backend",
        question:
            "What does the server do when the request arrives?",

        covers:
            "routes, endpoints, controllers, services, request and response " +
            "handling, status codes, middleware, start-up and health checks, " +
            "and calls out to other services"
    },

    {
        id: "database",
        label: "Database",
        question:
            "What is read or written, and where?",

        covers:
            "queries, inserts, updates, tables, columns, transactions, " +
            "connection pools, migrations, schemas, caches, and local storage"
    },

    {
        id: "security",
        label: "Security",
        question:
            "What decides whether this is allowed?",

        covers:
            "signing in, tokens, sessions, passwords, hashing, permission " +
            "checks, validating anything a stranger can send, and the errors " +
            "thrown when a check fails"
    }
];


export const LENS_IDS =
    LENSES.map(
        lens => lens.id
    );


// --------------------------------------------------
// SYNONYMS
// --------------------------------------------------
// What models and older PlanMap versions call these perspectives. Anything
// unrecognised is dropped rather than guessed at, so a stray tag never
// silently becomes a seventh lens.
// --------------------------------------------------

const SYNONYMS = {
    ui: "frontend",
    interface: "frontend",
    client: "frontend",
    view: "frontend",
    views: "frontend",
    presentation: "frontend",
    dom: "frontend",
    component: "frontend",
    browser: "frontend",

    server: "backend",
    api: "backend",
    routing: "backend",
    controller: "backend",
    service: "backend",
    middleware: "backend",
    "business-logic": "backend",
    integration: "backend",
    external: "backend",
    "third-party": "backend",
    sdk: "backend",
    webhook: "backend",
    platform: "backend",
    infrastructure: "backend",
    infra: "backend",
    config: "backend",
    configuration: "backend",
    ops: "backend",
    devops: "backend",
    monitoring: "backend",
    logging: "backend",
    bootstrap: "backend",

    data: "database",
    db: "database",
    persistence: "database",
    storage: "database",
    model: "database",
    models: "database",
    sql: "database",
    query: "database",

    safety: "security",
    auth: "security",
    authentication: "security",
    authorization: "security",
    authorisation: "security",
    oauth: "security",
    validation: "security",
    crypto: "security",
    "error-handling": "security"
};


// --------------------------------------------------
// CANONICAL LENS
// --------------------------------------------------
// Maps one tag onto the vocabulary, or null when it belongs to none of the
// six. Also migrates evolution graphs written before the vocabulary was fixed.
// --------------------------------------------------

export function canonicalLens(
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
        LENS_IDS.includes(key)
    ) {
        return key;
    }

    return SYNONYMS[key] || null;
}


// --------------------------------------------------
// CANONICAL LENSES
// --------------------------------------------------
// A node's tags, mapped and de-duplicated, in vocabulary order.
// --------------------------------------------------

export function canonicalLenses(
    values
) {
    const mapped =
        new Set(
            (Array.isArray(values)
                ? values
                : []
            )
                .map(canonicalLens)
                .filter(Boolean)
        );

    return LENS_IDS.filter(
        id => mapped.has(id)
    );
}


// --------------------------------------------------
// LENS CATALOGUE
// --------------------------------------------------
// The block both prompts embed, so the model classifies against the same
// written definitions the interface filters by.
// --------------------------------------------------

export function lensCatalogue() {
    return LENSES
        .map(
            lens =>
                `${lens.id}\n` +
                `  Asks: ${lens.question}\n` +
                `  Covers: ${lens.covers}`
        )
        .join("\n\n");
}


// --------------------------------------------------
// LAYER NAMES
// --------------------------------------------------
// Words that name a layer rather than a job, and so must never become a
// grouping level: the lens vocabulary already carries that axis, and
// repeating it nests the same distinction twice.
//
// Deliberately much narrower than the synonym table. "Authentication",
// "Validation" and "Monitoring" all map onto a lens, but each also names
// real work a part of a project does, so each makes a good heading. Only
// words that are purely an axis are refused.
// --------------------------------------------------

const LAYER_NAMES = new Set([
    ...LENS_IDS,
    "interface",
    "server",
    "safety",
    "data",
    "ui",
    "client",
    "api",
    "db",
    "infrastructure",
    "infra",
    "platform",
    "integration",
    "middleware",
    "controller",
    "service",
    "services",
    "utils",
    "utilities",
    "helpers",
    "misc",
    "miscellaneous",
    "core",
    "general",
    "common",
    "shared",
    "operations",
    "ops",
    "management",
    "handling",
    "processing",
    "logic",
    "functionality",
    "features",
    "components",
    "modules"
]);

export function isLayerName(
    value
) {
    return (
        typeof value === "string" &&
        LAYER_NAMES.has(
            value
                .trim()
                .toLowerCase()
        )
    );
}
