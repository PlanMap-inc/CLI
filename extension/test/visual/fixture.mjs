// --------------------------------------------------
// WHAT THE VIEW HAS TO SURVIVE
// --------------------------------------------------
// Shaped from the cases that broke it. Every awkward thing a real plan
// does is in here on purpose, because the bugs this harness exists to
// catch were all invisible until something in the plan was long, folded,
// merged or pointing at another feature:
//
//   - a step whose code calls into another feature (the "↗" chip)
//   - a lens reading long enough to need an ellipsis
//   - a Terms row with several chips, and a Project setup row
//   - a feature with more lenses than fit, and a 60-character name
//   - a folded part carrying a failing count
//   - a summary step, a merged step with a long title, a drifted step
// --------------------------------------------------

const step = (id, feature, order, extra = {}) => ({
    id, feature, step: order, role: "behaviour",
    identity: `src/${feature}/${id}.js::${id}:function`,
    title: `Step ${id}`, intent: `${id} happens once`,
    lensTags: [], rules: [], edgesOut: [], status: "intended", origin: "ai_drafted",
    ...extra
});

// Sixteen steps over three parts, so the feature folds and one part
// carries a drifted step.
const parts = ["application", "app.request", "app.response"];

const big = Array.from({ length: 16 }, (_, at) => step(`app${at}`, "express", at + 20, {
    title: at % 3 === 0
        ? "Answer the request with the application's configured status code"
        : `Handle the ${at} application route`,
    path: [parts[Math.floor(at / 6)] ?? parts[2]],
    lensTags: at % 2 ? ["backend"] : ["security"],
    status: "approved", approvedBy: "sam", version: 1
}));

export const plan = {
    version: 1,
    lenses: [
        { id: "frontend", label: "Frontend" },
        { id: "backend", label: "Backend" },
        { id: "database", label: "Database" },
        { id: "security", label: "Security" }
    ],
    features: [
        // Sixty characters, which is what a real capability name reaches.
        { id: "survey", name: "Results and the admin export for every agency, state and MP" },
        { id: "express", name: "Express core" },
        { id: "infra", name: "Infrastructure" }
    ],
    nodes: [
        step("submit", "survey", 1, {
            title: "Record every submitted answer before the response is sent",
            identity: "src/survey/survey.controller.js::submitSurvey:function",
            lensTags: ["security", "backend"],
            readings: {
                security: "Refuses an empty answer before it leaves the browser, and again on arrival",
                backend: "Writes the answer row and returns the id the client will poll on"
            },
            edgesOut: ["persist"],
            rules: [
                { kind: "behaviour", target: "src/survey/survey.controller.js::submitSurvey:function", assert: { throws: { op: ">=", value: 1 } } },
                { kind: "behaviour", target: "src/survey/survey.controller.js::submitSurvey:function", assert: { calls: { op: "contains", value: "persistAnswers" } } }
            ]
        }),
        step("persist", "survey", 2, {
            title: "Write the answers in one transaction",
            identity: "src/survey/survey.service.js::persistAnswers:function",
            lensTags: ["database"],
            readings: { database: "Rejects a person who already answered, inside the same transaction" },
            status: "approved", approvedBy: "sam", version: 1
        }),
        step("score", "survey", 3, {
            title: "Score the risk for every agency, MP and state in the register",
            identity: "src/risk.py::agency_risk:function",
            identities: ["src/risk.py::agency_risk:function", "src/risk.py::mp_risk:function", "src/risk.py::state_risk:function"],
            dimensions: ["agency", "MP", "state"],
            lensTags: ["backend"]
        }),
        step("createApp", "survey", 4, {
            title: "Build the application object",
            identity: "src/express/application.js::createApp:function",
            identities: Array.from({ length: 10 }, (_, at) => `src/express/application.js::m${at}:function`),
            merge: "summary",
            summaryOf: Array.from({ length: 10 }, (_, at) => ({
                identities: [`src/express/application.js::m${at}:function`],
                title: `Set the ${at} application default`
            })),
            lensTags: ["backend"]
        }),
        // Calls INTO another feature: this is what draws the "↗" chip.
        step("listAll", "survey", 5, {
            title: "List every response for the admin",
            identity: "src/survey/admin.js::listResponses:function",
            lensTags: ["frontend", "backend"],
            readings: { frontend: "Shows the admin every response, newest first, one page at a time" },
            edgesOut: ["app0"]
        }),
        step("render", "survey", 6, {
            title: "Render the thank-you page",
            identity: "src/survey/render.js::renderThanks:function",
            lensTags: ["frontend"]
        }),
        ...big,
        { id: "v1", feature: "survey", role: "vocabulary", identity: "src/survey/q.js::QUESTIONS:data", title: "The twelve survey screens", intent: "x", lensTags: [] },
        { id: "v2", feature: "survey", role: "vocabulary", identity: "src/survey/q.js::STATUSES:data", title: "Answer statuses", intent: "x", lensTags: [] },
        { id: "v3", feature: "survey", role: "vocabulary", identity: "src/survey/q.js::ROLES:data", title: "Who may read a response, by role", intent: "x", lensTags: [] },
        { id: "m1", feature: "survey", role: "machinery", identity: "src/db.js::connect:function", title: "Connect the pool", intent: "x", lensTags: [] },
        { id: "t1", feature: "survey", role: "tool", identity: "src/fmt.js::formatDate:function", title: "Format a date", intent: "x", lensTags: [] },
        // A feature with no steps at all: everything it holds goes into
        // the Constellation's Project setup row.
        { id: "i1", feature: "infra", role: "machinery", identity: "src/boot.js::boot:function", title: "Start the HTTP listener", intent: "x", lensTags: [] },
        { id: "i2", feature: "infra", role: "vocabulary", identity: "src/boot.js::PORTS:data", title: "Ports and their defaults", intent: "x", lensTags: [] }
    ]
};

// One drifted step in the small feature, and one inside a folded part.
export const verifiedStatus = {
    "src/survey/survey.service.js::persistAnswers:function": { status: "drifted", verifiedAgainst: "persist@1" },
    "src/express/app7.js::app7:function": { status: "drifted", verifiedAgainst: "app7@1" }
};

export const facts = {
    "src/survey/survey.controller.js::submitSurvey:function": {
        throws: 0, throwTypes: [], returns: 3, returnsNullish: 0,
        calls: ["persistAnswers", "res.status"], numbers: [201, 400],
        awaits: 1, catches: 1, emptyCatches: 0, params: 2
    },
    "src/survey/render.js::renderThanks:function": {
        throws: 0, throwTypes: [], returns: 1, returnsNullish: 0,
        calls: ["res.render"], numbers: [], awaits: 0, catches: 0, emptyCatches: 0, params: 2
    },
    "src/survey/admin.js::listResponses:function": {
        throws: 0, throwTypes: [], returns: 2, returnsNullish: 0,
        calls: ["findResponses", "res.json"], numbers: [50], awaits: 1, catches: 0, emptyCatches: 0, params: 2
    }
};

export const state = {
    setup: "ready",
    projectName: "express",
    projectRoot: "/work/express",
    plan,
    verifiedStatus,
    facts,
    evolution: { version: 1, nodes: [] },
    arrivals: [],
    scan: null,
    pendingScan: null,
    aiKey: "stored"
};
