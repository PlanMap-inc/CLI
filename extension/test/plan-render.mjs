import assert from "node:assert/strict";

import {
    cardHeight,
    CARD_GAP,
    buildConstellation,
    buildSpine,
    constellationEdges,
    detailLine,
    featureRegisters,
    FEATURE_H,
    FLAT_LIMIT,
    nodeSub,
    partsOf,
    roleOf,
    STEP_H
} from "../webview/model.js";

const plan = {
    version: 1,
    lenses: [{ id: "business", label: "Business" }, { id: "backend", label: "Backend" }],
    features: [
        { id: "auth", name: "Login" },
        { id: "orders", name: "Orders" },
        { id: "empty", name: "Ratings" }
    ],
    nodes: [
        { id: "a1", title: "Enter email", intent: "x", feature: "auth", edgesOut: ["a2"] },
        { id: "a2", title: "Enter password", intent: "x", feature: "auth", edgesOut: ["a3"] },
        { id: "a3", title: "Hash check", intent: "x", feature: "auth", edgesOut: ["a4", "missing_node"] },
        { id: "a4", title: "JWT issued", intent: "x", feature: "auth", edgesOut: ["o1"], identity: "auth/middleware.js::verifyJWT:function" },
        { id: "o1", title: "Create order", intent: "x", feature: "orders", edgesOut: ["o2", "o3"] },
        { id: "o2", title: "Validate cart", intent: "x", feature: "orders", edgesOut: [] },
        { id: "o3", title: "Charge", intent: "x", feature: "orders", edgesOut: ["o1"] }
    ]
};

// Constellation: one card per feature that has steps, with the count.
const constellation = buildConstellation(plan, {});

assert.equal(constellation.cards.length, 2, "Ratings has no steps, so it gets no card");
assert.deepEqual(constellation.cards.map(n => n.sub), ["4 steps", "3 steps"]);
assert.deepEqual(constellation.cards.map(n => n.step), [1, 2], "features are numbered in the order they are met");
assert.deepEqual(constellation.cards.map(n => n.title), ["Login", "Orders"]);

// --------------------------------------------------
// THE CONSTELLATION READS DOWNWARDS
// --------------------------------------------------
// It used to climb, so the journey ran up while the feature you opened
// from it ran down: one map, two directions, and a reader re-orienting at
// every click.

const featureY = constellation.cards.map(n => n.y);

assert.ok(featureY[0] < featureY[1], "the first feature sits at the top");
assert.equal(new Set(constellation.cards.map(n => n.x)).size, 1, "one column");

// Every card is the same height, so the pitch is fixed.
assert.ok(constellation.cards.every(card => card.h === FEATURE_H));

// Snapped to the grid, so the pitch is the card plus the gap rounded to
// the nearest 24 - never less than the card, which is what stops two
// cards overlapping.
assert.ok(
    featureY[1] - featureY[0] >= FEATURE_H,
    `cards overlap: ${featureY[1] - featureY[0]} < ${FEATURE_H}`
);
assert.ok(featureY[1] - featureY[0] <= FEATURE_H + CARD_GAP);

// --------------------------------------------------
// A FEATURE WITH NO STEPS IS NOT A STAGE OF THE JOURNEY
// --------------------------------------------------
// It used to draw an empty box. Whatever it holds goes into one folded
// row under the journey instead.

const setup = buildConstellation({
    ...plan,
    nodes: [...plan.nodes, { id: "e1", title: "DB config", intent: "x", feature: "empty", role: "vocabulary" }]
}, {});

assert.equal(setup.cards.length, 2, "still no card for the stepless feature");
assert.equal(setup.setup.title, "Project setup");
assert.equal(setup.setup.count, 1);
assert.deepEqual(setup.setup.chips.map(chip => chip.title), ["DB config"]);
assert.ok(setup.setup.y > setup.cards.at(-1).y, "and it sits under the journey");

assert.equal(buildConstellation(plan, {}).setup, null, "nothing left over, no row");

// Connected by the plan's own links: a4 (auth) points at o1 (orders). Nothing
// links orders to Ratings, so that pair falls back to reading order - the real
// auth->orders edge does not get to strand every feature after it.
assert.deepEqual(constellationEdges(plan), [
    { from: "auth", to: "orders", source: "nodes" },
    { from: "orders", to: "empty", source: "order" }
]);

// With no links across features, the plan's order connects them.
const unlinked = { features: [{ id: "a" }, { id: "b" }, { id: "c" }], nodes: [{ id: "n", feature: "a", edgesOut: [] }] };
assert.deepEqual(constellationEdges(unlinked), [
    { from: "a", to: "b", source: "order" },
    { from: "b", to: "c", source: "order" }
]);
assert.deepEqual(constellationEdges({ features: [{ id: "only" }], nodes: [] }), [], "one feature has nothing to connect to");
assert.deepEqual(constellationEdges(null), []);


// --------------------------------------------------
// FEATURE SPACE IS ONE COLUMN
// --------------------------------------------------
// Whatever the links do. A chain, a cycle and a pair of siblings all read
// the same way: down, in step order, one to a row.

const spineOf = (source, feature, options = {}) =>
    buildSpine(source, feature, options).items.filter(item => item.kind === "step");

const auth = spineOf(plan, "auth");

assert.equal(auth.length, 4);
assert.equal(new Set(auth.map(item => item.x)).size, 1);
assert.deepEqual(auth.map(item => item.number), ["1", "2", "3", "4"]);
assert.ok(auth.every(item => item.h === STEP_H), "every card the same height");

// A cycle (o1 -> o3 -> o1) is a finite column like anything else.
const orders = spineOf(plan, "orders");

assert.equal(orders.length, 3);
assert.equal(new Set(orders.map(item => item.y)).size, 3, "no two steps share a row");

// A feature with no nodes draws nothing, and does not throw.
assert.deepEqual(buildSpine(plan, "empty", {}).items, []);
assert.deepEqual(buildSpine(plan, "empty", {}).links, []);


// --------------------------------------------------
// THE LINE IS THE ORDER, AND NEVER A CALL
// --------------------------------------------------
// A feature whose nodes carry no links of their own used to be drawn as a
// set, because the layout came from the links. The line is the order now,
// so it is always there and always means the same thing.

const unlinkedFeature = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "u1", title: "One", intent: "x", feature: "f", step: 1, edgesOut: [] },
        { id: "u2", title: "Two", intent: "x", feature: "f", step: 2, edgesOut: [] },
        { id: "u3", title: "Three", intent: "x", feature: "f", step: 3, edgesOut: [] }
    ]
};

const unchained = buildSpine(unlinkedFeature, "f", {});

assert.deepEqual(
    unchained.links,
    [{ from: "u1", to: "u2" }, { from: "u2", to: "u3" }],
    "neighbours are joined in order, with nothing claimed about cause"
);

assert.deepEqual(
    buildSpine({ features: [{ id: "f" }], nodes: [{ id: "only", feature: "f", title: "O", intent: "x" }] }, "f", {}).links,
    [],
    "one step has nothing to connect to"
);


// --------------------------------------------------
// EVIDENCE IS ONE LINE, NOT A BLOCK
// --------------------------------------------------
// It used to stack two lines under every title, which made a column of
// steps a column of inspectors. The card carries one detail line, and the
// panel carries the whole list.

const factsByIdentity = {
    "auth/middleware.js::verifyJWT:function": {
        throws: 0, throwTypes: [], returns: 3, returnsNullish: 0,
        calls: ["authHeader.split", "jwt.verify", "next", "res.status"],
        numbers: [1, 401], awaits: 0, catches: 1, emptyCatches: 0, params: 3
    }
};

const jwt = plan.nodes.find(node => node.id === "a4");

assert.deepEqual(
    detailLine(jwt, { facts: factsByIdentity }),
    { kind: "evidence", text: "calls authHeader.split" },
    "the first fact, and only the first"
);

assert.equal(detailLine(jwt, { facts: {} }), null, "no facts, no line - never an invented one");
assert.equal(detailLine(jwt), null, "and no facts argument at all still works");

// A card's height never depends on what it holds any more.
assert.equal(cardHeight(), STEP_H);
assert.equal(cardHeight({ evidence: ["a", "b", "c"], backing: 9 }), STEP_H);


// --------------------------------------------------
// ROLES: ONLY A BEHAVIOUR IS A STEP
// --------------------------------------------------

const mixed = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "s1", title: "Submit the survey", intent: "x", feature: "f", step: 1, role: "behaviour" },
        { id: "v1", title: "Survey questions", intent: "x", feature: "f", role: "vocabulary" },
        { id: "m1", title: "Connect the pool", intent: "x", feature: "f", role: "machinery" },
        { id: "t1", title: "Format a date", intent: "x", feature: "f", role: "tool" },
        { id: "s2", title: "Answer 200", intent: "x", feature: "f", step: 2, role: "behaviour" }
    ]
};

assert.deepEqual(spineOf(mixed, "f").map(item => item.id), ["s1", "s2"], "only behaviours are on the line");

const registers = buildSpine(mixed, "f", {}).items.filter(item => item.kind === "register");

assert.deepEqual(
    registers.map(row => [row.title, row.count]),
    [["Terms", 1], ["Runs on", 1], ["Helpers", 1]],
    "the rest are rows beside the line, one per kind"
);

assert.ok(registers.every(row => row.offLine), "and never on it");

// Terms sit above the steps; preconditions and helpers below.
const items = buildSpine(mixed, "f", {}).items;
assert.equal(items[0].title, "Terms");
assert.deepEqual(items.slice(-2).map(row => row.title), ["Runs on", "Helpers"]);

// A plan drafted before roles existed has every node on the spine, exactly
// as it did before roles.
const legacy = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "l1", title: "One", intent: "x", feature: "f" },
        { id: "l2", title: "Two", intent: "x", feature: "f" }
    ]
};

assert.equal(featureRegisters(legacy, "f").spine.length, 2);
assert.equal(spineOf(legacy, "f").length, 2);
assert.equal(roleOf({}), "behaviour");


// --------------------------------------------------
// PARTS
// --------------------------------------------------
// A long feature folds by the heading the outline already gave each step.
// A short one never does: splitting five steps into two labelled rows
// fragments something that would read as one flow on its own.

const short = Array.from({ length: 5 }, (_, at) =>
    ({ id: `p${at}`, title: `Step ${at}`, intent: "x", feature: "f", step: at + 1, path: [at % 2 ? "Fetch" : "Transform"] }));

assert.equal(buildSpine({ features: [{ id: "f", name: "F" }], nodes: short }, "f", {}).folded, false,
    `${short.length} steps is under FLAT_LIMIT (${FLAT_LIMIT})`);

// Past the limit it folds, in the order the journey reaches each part.
const long = Array.from({ length: FLAT_LIMIT + 4 }, (_, at) =>
    ({ id: `q${at}`, title: `Step ${at}`, intent: "x", feature: "f", step: at + 1, path: [at < 6 ? "Fetch" : "Transform"] }));

const folded = buildSpine({ features: [{ id: "f", name: "F" }], nodes: long }, "f", {});

assert.equal(folded.folded, true);
assert.deepEqual(folded.parts.map(part => part.name), ["Fetch", "Transform"], "in the order their first step comes");

// Steps the outline never placed come last, whenever they turned up.
assert.deepEqual(
    partsOf([
        { id: "a", step: 1, path: ["Write"] },
        { id: "b", step: 2 },
        { id: "c", step: 3, path: ["Read"] }
    ]).map(part => part.name),
    ["Write", "Read", "Other steps"]
);


// --------------------------------------------------
// A STEP STANDING FOR SEVERAL DECLARATIONS
// --------------------------------------------------
// The card says how many rather than naming the first and quietly holding
// the rest.

assert.equal(nodeSub({ identity: "api.py::get_agencies:function" }), "get_agencies() · api.py");
assert.equal(
    nodeSub({ identity: "risk.py::agency_risk:function", identities: ["risk.py::agency_risk:function", "risk.py::mp_risk:function"] }),
    "2 declarations · risk.py"
);
assert.equal(nodeSub({}), "greenfield");

assert.deepEqual(
    detailLine({ identity: "a.js::x:function", identities: ["a.js::x:function", "a.js::y:function"], dimensions: ["agency", "MP"] }),
    { kind: "dimensions", text: "across agency · MP" }
);


// --------------------------------------------------
// NO FABRICATED CROSS-FEATURE EDGE
// --------------------------------------------------
// Shaped on the real AI_Coding_Survey project after the draft.js fix: Login
// and Survey each have real edges *inside* themselves (from real calls) but
// nothing links across the two features, because nothing in the real code
// does. constellationEdges() must fall back to the honestly-labelled
// "order" source rather than pretending one of them is a real relationship.
// --------------------------------------------------

const noCrossFeaturePlan = {
    version: 1,
    lenses: [],
    features: [{ id: "login", name: "Login" }, { id: "survey", name: "Survey" }],
    nodes: [
        { id: "n1", feature: "login", edgesOut: ["n2"] },
        { id: "n2", feature: "login", edgesOut: [] },
        { id: "n3", feature: "survey", edgesOut: ["n4"] },
        { id: "n4", feature: "survey", edgesOut: [] }
    ]
};

const fallbackEdges = constellationEdges(noCrossFeaturePlan);
assert.equal(fallbackEdges.length, 1);
assert.equal(fallbackEdges[0].source, "order", "no node's edgesOut crosses a feature boundary, so this must be the honest order fallback, not something dressed up as a real relationship");

// --------------------------------------------------
// A GENUINE CROSS-FEATURE EDGE IS REPORTED AS ONE
// --------------------------------------------------

const realCrossFeaturePlan = {
    ...noCrossFeaturePlan,
    nodes: [
        { id: "n1", feature: "login", edgesOut: ["n3"] }, // n1 really does lead into Survey
        { id: "n2", feature: "login", edgesOut: [] },
        { id: "n3", feature: "survey", edgesOut: [] },
        { id: "n4", feature: "survey", edgesOut: [] }
    ]
};

const realEdges = constellationEdges(realCrossFeaturePlan);
assert.equal(realEdges.length, 1);
assert.equal(realEdges[0].source, "nodes", "a genuine call-derived edge into another feature must be reported as a real relationship");

// --------------------------------------------------
// ONE REAL EDGE MUST NOT STRAND THE REST
// --------------------------------------------------
// The fallback is per adjacent pair, not per plan. While it was all-or-
// nothing, a single real link anywhere suppressed the order fallback for
// every other pair, and a plan with one earned arrow rendered as that arrow
// plus a row of disconnected islands.
// --------------------------------------------------

const mixedPlan = {
    version: 1,
    lenses: [],
    features: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }],
    nodes: [
        { id: "n1", feature: "a", edgesOut: ["n2"] }, // a really does lead into b
        { id: "n2", feature: "b", edgesOut: [] },
        { id: "n3", feature: "c", edgesOut: [] }
    ]
};

assert.deepEqual(constellationEdges(mixedPlan), [
    { from: "a", to: "b", source: "nodes" },
    { from: "b", to: "c", source: "order" }
], "a->b is real and is not duplicated by an order edge; c is still reached by reading order rather than left an island");

console.log("PASS: plan-render");
