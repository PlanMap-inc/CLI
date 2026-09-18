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
            "What does a person see, type, or click?",

        covers:
            "screens, forms, buttons, rendering, showing and hiding, " +
            "and anything that reads or writes the page"
    },

    {
        id: "backend",
        label: "Backend",
        question:
            "What happens on the server when a request arrives?",

        covers:
            "routes, endpoints, request handling, responses, " +
            "and rules that run server-side"
    },

    {
        id: "security",
        label: "Security",
        question:
            "What decides whether this is allowed?",

        covers:
            "signing in, tokens, sessions, passwords, permission checks, " +
            "and checking anything a stranger can send"
    },

    {
        id: "data",
        label: "Data",
        question:
            "What is stored, read back, or shaped?",

        covers:
            "saving, loading, queries, schemas, migrations, files, and caches"
    },

    {
        id: "integration",
        label: "Integration",
        question:
            "What outside this project does it depend on?",

        covers:
            "third-party APIs and SDKs, sign-in providers, payment and email " +
            "services, and webhooks"
    },

    {
        id: "platform",
        label: "Platform",
        question:
            "What has to be running for any of it to work?",

        covers:
            "start-up, configuration, environment, health checks, logging, " +
            "and build or deploy"
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
    client: "frontend",
    view: "frontend",
    views: "frontend",
    presentation: "frontend",
    dom: "frontend",

    api: "backend",
    server: "backend",
    routing: "backend",
    controller: "backend",
    service: "backend",
    middleware: "backend",
    "business-logic": "backend",

    auth: "security",
    authentication: "security",
    authorization: "security",
    authorisation: "security",
    validation: "security",
    crypto: "security",

    database: "data",
    db: "data",
    persistence: "data",
    storage: "data",
    model: "data",
    models: "data",

    external: "integration",
    "third-party": "integration",
    sdk: "integration",
    oauth: "integration",

    infrastructure: "platform",
    infra: "platform",
    config: "platform",
    configuration: "platform",
    ops: "platform",
    monitoring: "platform",
    logging: "platform",
    devops: "platform",
    bootstrap: "platform"
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
