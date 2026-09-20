import assert from "node:assert/strict";

import {
    bandsOf,
    cardHeight,
    CARD_GAP,
    buildConstellation,
    buildFeatureGraph,
    constellationEdges,
    featureRegisters,
    nodeSub,
    roleOf,
    NODE_H_EST
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

// Constellation: one node per feature, with the member count.
const constellation = buildConstellation(plan, {});
assert.equal(constellation.length, 3);
assert.deepEqual(constellation.map(n => n.sub), ["4 steps", "3 steps", "0 steps"]);
assert.deepEqual(constellation.map(n => n.step), [1, 2, 3], "features are numbered in the order they are met");
assert.deepEqual(constellation.map(n => n.title), ["Login", "Orders", "Ratings"]);

// Features stack bottom to top in plan order, in one column: the first
// thing a person does sits at the bottom, and the journey climbs.
const featureY = constellation.map(n => n.y);
assert.ok(featureY[0] > featureY[1] && featureY[1] > featureY[2], "the first feature sits at the bottom");
assert.equal(new Set(constellation.map(n => n.x)).size, 1);
for (let i = 1; i < featureY.length; i++) assert.ok(featureY[i - 1] - featureY[i] >= NODE_H_EST, "feature rows overlap");

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

// Feature Space: members only; dangling and cross-feature edges are dropped.
const auth = buildFeatureGraph(plan, "auth", {});
assert.equal(auth.nodes.length, 4);
assert.deepEqual(auth.edges, [
    { from: "a1", to: "a2" },
    { from: "a2", to: "a3" },
    { from: "a3", to: "a4" }
]);

// A chain lays out as one column, each step above the one it follows.
const y = Object.fromEntries(auth.nodes.map(n => [n.id, n.y]));
assert.ok(y.a1 > y.a2 && y.a2 > y.a3 && y.a3 > y.a4, "steps climb"),
assert.equal(new Set(auth.nodes.map(n => n.x)).size, 1);

// A cycle (o1 -> o3 -> o1) still produces a finite layout and keeps both edges.
const orders = buildFeatureGraph(plan, "orders", {});
assert.equal(orders.nodes.length, 3);
assert.equal(orders.edges.length, 3);
for (const n of orders.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));

// Siblings share a ROW, side by side. o2 and o3 both follow o1 and neither
// leads to the other, so stacking them would draw a sequence the code does
// not have - which is what a single column could only ever do.
const rowY = orders.nodes.filter(n => n.id !== "o1").map(n => n.y);
assert.equal(new Set(rowY).size, 1, "o2 and o3 share a row");
assert.equal(new Set(orders.nodes.filter(n => n.id !== "o1").map(n => n.x)).size, 2, "and sit apart on it");
assert.ok(orders.nodes.find(n => n.id === "o1").y > rowY[0], "o1 leads to both, so it sits below them");

assert.deepEqual(
    buildFeatureGraph(plan, "empty", {}),
    { nodes: [], edges: [], bands: [], topRowX: 300, bottomRowX: 300 }
);

// --------------------------------------------------
// AN EDGE NEEDS EVIDENCE
// --------------------------------------------------
// A feature whose nodes carry no links of their own used to be chained in
// plan order. That arrow asserted a sequence nothing had established, and a
// reader cannot tell an invented arrow from an earned one. Now nothing is
// drawn, and the steps sit together as what they are.
const unlinkedFeature = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "n1", title: "One", feature: "f", step: 1, edgesOut: [] },
        { id: "n2", title: "Two", feature: "f", step: 2 },
        { id: "n3", title: "Three", feature: "f", step: 3, edgesOut: [] }
    ]
};
const unchained = buildFeatureGraph(unlinkedFeature, "f", {});
assert.deepEqual(unchained.edges, [], "no call evidence, no arrows");
assert.equal(new Set(unchained.nodes.map(n => n.y)).size, 1, "they share one row");
assert.deepEqual(unchained.nodes.map(n => n.id), ["n1", "n2", "n3"], "in the order a person meets them");
assert.equal(new Set(unchained.nodes.map(n => n.x)).size, 3, "spread across it");

assert.equal(buildFeatureGraph({ features: [{ id: "f" }], nodes: [{ id: "only", feature: "f" }] }, "f", {}).edges.length, 0, "one node has nothing to connect to");

// --------------------------------------------------
// EVIDENCE RIDES ALONG WITH EACH STEP, CAPPED FOR THE CARD
// --------------------------------------------------

const factsByIdentity = {
    "auth/middleware.js::verifyJWT:function": {
        calls: ["authHeader.split", "jwt.verify", "next", "res.status"],
        numbers: [1, 401],
        catches: 1
    }
};

// Reuses this file's existing `plan` fixture - a4 ("JWT issued") is the auth
// feature's node carrying this identity, added above alongside the fixture.
const withEvidence = buildFeatureGraph(plan, "auth", {}, null, null, factsByIdentity);
const verifyStep = withEvidence.nodes.find(n => n.source.identity === "auth/middleware.js::verifyJWT:function");

assert.ok(verifyStep, "the fixture's a4 node carries this identity");
assert.deepEqual(verifyStep.evidence, ["calls authHeader.split", "answers 401"]);

const noFacts = buildFeatureGraph(plan, "auth", {}, null, null, {});
assert.ok(noFacts.nodes.every(n => Array.isArray(n.evidence) && n.evidence.length === 0), "no facts supplied means every step's evidence is an empty array, never invented");

// The row is measured with those lines in it. It was not, once: the card
// rendered two lines taller than the layout believed, so the gap below it
// closed up and the edge into it stopped partway inside the card above.
assert.ok(
    verifyStep.h > noFacts.nodes.find(n => n.id === "a4").h,
    "a step carrying evidence lines must be laid out taller than the same step without them"
);
assertNoOverlap(withEvidence.nodes, "feature space with evidence");

// Existing callers that pass no factsByIdentity at all still work.
const noArgAtAll = buildFeatureGraph(plan, "auth", {});
assert.ok(noArgAtAll.nodes.every(n => Array.isArray(n.evidence)));

// --------------------------------------------------
// ROLES: ONLY A BEHAVIOUR IS A STEP
// --------------------------------------------------
const mixed = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "b1", title: "Verify the credential", feature: "f", step: 1, role: "behaviour" },
        { id: "v1", title: "Three allowed columns", feature: "f", step: 2, role: "vocabulary" },
        { id: "m1", title: "Open the connection pool", feature: "f", step: 3, role: "machinery" },
        { id: "t1", title: "Build a slug", feature: "f", step: 4, role: "tool" }
    ]
};

const registers = featureRegisters(mixed, "f");
assert.deepEqual(registers.spine.map(n => n.id), ["b1"]);
assert.deepEqual(registers.vocabulary.map(n => n.id), ["v1"]);
assert.deepEqual(registers.machinery.map(n => n.id), ["m1"]);
assert.deepEqual(registers.tools.map(n => n.id), ["t1"]);
assert.equal(registers.total, 4, "every node is in exactly one register - nothing is dropped");

assert.deepEqual(
    buildFeatureGraph(mixed, "f", {}).nodes.map(n => n.id),
    ["b1"],
    "the spine holds what the system does; the rest are drawn beside it"
);

// A plan drafted before roles existed has every node on the spine, exactly
// as it did then.
assert.equal(featureRegisters(plan, "auth").spine.length, 4);
assert.equal(roleOf({ title: "x" }), "behaviour");
assert.equal(roleOf({ role: "tool" }), "tool");
assert.equal(roleOf({ role: "nonsense" }), "behaviour");

// --------------------------------------------------
// BANDS
// --------------------------------------------------
// Lanes on one canvas, in the order the journey reaches them - not cards to
// click into. One band is not a banding.
assert.deepEqual(bandsOf([{ id: "a", path: ["Fetch"] }, { id: "b", path: ["Fetch"] }]), [], "one heading is just the feature");
assert.deepEqual(bandsOf([{ id: "a" }, { id: "b" }]), [], "no headings, no bands");

const banded = bandsOf([
    { id: "a", path: ["Build"], step: 5 },
    { id: "b", path: ["Fetch"], step: 1 },
    { id: "c", path: ["Build"], step: 6 },
    { id: "d", path: ["Fetch"], step: 2 }
]);
assert.deepEqual(banded.map(b => b.name), ["Fetch", "Build"], "bands run in journey order, not plan order");
assert.deepEqual(banded.map(b => b.nodes.length), [2, 2]);

const bandedGraph = buildFeatureGraph({
    features: [{ id: "f" }],
    nodes: [
        { id: "a", title: "A", feature: "f", path: ["Fetch"], step: 1 },
        { id: "b", title: "B", feature: "f", path: ["Build"], step: 2 }
    ]
}, "f", {});
assert.deepEqual(bandedGraph.bands.map(b => b.name), ["Fetch", "Build"]);
assert.ok(bandedGraph.bands[0].bottom > bandedGraph.bands[1].bottom, "the first band sits lowest");
assert.ok(bandedGraph.bands.every(b => b.count === 1));

// --------------------------------------------------
// A STEP STANDING FOR SEVERAL DECLARATIONS
// --------------------------------------------------
const merged = buildFeatureGraph({
    features: [{ id: "f" }],
    nodes: [{
        id: "m",
        title: "Look up the risk score for any scope",
        feature: "f",
        identity: "api.py::get_agencies:function",
        identities: ["api.py::get_agencies:function", "api.py::get_mps:function", "api.py::get_states:function"],
        dimensions: ["agency", "MP", "state"]
    }]
}, "f", {});

assert.equal(merged.nodes[0].backing, 3);
assert.deepEqual(merged.nodes[0].dimensions, ["agency", "MP", "state"]);
assert.equal(merged.nodes[0].sub, "3 declarations · api.py", "the step says how many it stands for");
assert.equal(
    nodeSub({ identity: "api.py::get_agencies:function" }),
    "get_agencies() · api.py",
    "an ordinary step still names its one declaration"
);

// --------------------------------------------------
// CARDS MUST NOT OVERLAP
// --------------------------------------------------
// A card's height depends on what it holds - a Constellation card carries a
// preview of what it opens onto, a merged step carries the nouns it reads
// across. The layout used to stack them on a fixed 144px pitch, so a card
// with three preview lines was drawn straight through the one above it.

assert.ok(cardHeight({}) < cardHeight({ preview: [1, 2, 3] }), "a preview makes a card taller");
assert.ok(cardHeight({}) < cardHeight({ backing: 3 }), "so does standing for several declarations");
assert.ok(cardHeight({}) < cardHeight({ evidence: ["calls jwt.verify"] }), "so do the evidence lines a step carries");
assert.ok(cardHeight({ evidence: ["one"] }) < cardHeight({ evidence: ["one", "two"] }), "two evidence lines are taller than one");
assert.equal(cardHeight({ preview: [] }), cardHeight({}), "an empty preview costs nothing");
assert.equal(cardHeight({ evidence: [] }), cardHeight({}), "neither does an empty evidence list - a Constellation card never has the field at all");

function assertNoOverlap(cards, what) {
    const stacked = [...cards].sort((a, b) => a.y - b.y);

    for (let i = 1; i < stacked.length; i += 1) {
        const above = stacked[i - 1];
        const below = stacked[i];

        // Cards sharing a row sit side by side, so they only have to clear
        // each other horizontally.
        if (above.y === below.y) {
            assert.notEqual(above.x, below.x, `${what}: two cards on one spot`);
            continue;
        }

        const gap = below.y - (above.y + (above.h ?? 104));
        assert.ok(gap >= 0, `${what}: "${below.title}" overlaps "${above.title}" by ${-gap}px`);
    }
}

// Eleven features, each with a different amount to show.
const many = {
    lenses: [],
    features: Array.from({ length: 11 }, (_, i) => ({ id: `f${i}`, name: `Feature ${i}` })),
    nodes: Array.from({ length: 11 }, (_, i) =>
        Array.from({ length: (i % 4) + 1 }, (_, j) => ({
            id: `n${i}_${j}`, title: `Step ${j} of ${i}`, feature: `f${i}`, step: j + 1, role: "behaviour", path: [`Part ${j % 2}`]
        }))).flat()
};

const stack = buildConstellation(many, {});
assert.equal(stack.length, 11);
assertNoOverlap(stack, "constellation");
assert.ok(stack.every(card => card.h >= 104), "every card reports its height");

// The gap between neighbours is the one the layout promises, give or take
// the 24px grid it snaps to.
const ordered = [...stack].sort((a, b) => a.y - b.y);
for (let i = 1; i < ordered.length; i += 1) {
    const gap = ordered[i].y - (ordered[i - 1].y + ordered[i - 1].h);
    assert.ok(Math.abs(gap - CARD_GAP) <= 24, `neighbouring cards sit ${gap}px apart, not ${CARD_GAP}`);
}

// The first feature is at the bottom: the journey climbs.
assert.ok(stack[0].y > stack[10].y, "feature one sits below feature eleven");

// And inside a feature, where a merged step is taller than its neighbours.
const tallRow = buildFeatureGraph({
    features: [{ id: "f" }],
    nodes: [
        { id: "a", title: "Plain", feature: "f", step: 1, path: ["P"] },
        { id: "b", title: "Merged", feature: "f", step: 2, path: ["Q"], identity: "x::b:function", identities: ["x::b:function", "x::c:function"] },
        { id: "c", title: "After", feature: "f", step: 3, path: ["R"] }
    ]
}, "f", {});

assertNoOverlap(tallRow.nodes, "feature space");
assert.ok(
    tallRow.nodes.find(n => n.id === "b").h > tallRow.nodes.find(n => n.id === "a").h,
    "the merged step's row is taller"
);

// Each band spans the rows it really covers, so its lane cannot stop short.
for (const band of tallRow.bands) {
    assert.ok(band.height >= 104, `band ${band.name} has no height`);
    assert.ok(band.bottom >= band.top);
}

// --------------------------------------------------
// THE NUMBER ON A CARD COUNTS THE CANVAS
// --------------------------------------------------
// Grouping a spine by heading costs the plan's step order, because headings
// recur rather than running in sequence. The number used to be the plan's
// own step, so a grouped feature read 1, 2, 4, 3 down the page. It now
// counts what is in front of the reader, and the plan's step is kept beside
// it rather than thrown away.

const interleaved = buildFeatureGraph({
    features: [{ id: "f" }],
    lenses: [],
    nodes: [
        { id: "n1", title: "Initialize the button", feature: "f", step: 1, path: ["Start up"] },
        { id: "n2", title: "Store the session", feature: "f", step: 2, path: ["Sign in"] },
        { id: "n3", title: "Send the token", feature: "f", step: 3, path: ["Tokens"] },
        { id: "n4", title: "Send the identity", feature: "f", step: 4, path: ["Sign in"] }
    ]
}, "f", {});

const upTheCanvas = [...interleaved.nodes].sort((a, b) => b.y - a.y);

assert.deepEqual(upTheCanvas.map(n => n.step), [1, 2, 3, 4], "the numbers always climb");
assert.deepEqual(upTheCanvas.map(n => n.planStep), [1, 2, 4, 3], "the plan's own order is kept, and differs");
assert.deepEqual(interleaved.bands.map(b => b.name), ["Start up", "Sign in", "Tokens"]);

// --------------------------------------------------
// A BAND KNOWS WHERE ITS OWN CARDS START
// --------------------------------------------------
// A label placed from the leftmost card in the whole feature is dragged out
// by whichever row is widest: one measured feature had a lane 20px from its
// steps and two others 236px away.

const lopsided = buildFeatureGraph({
    features: [{ id: "f" }],
    lenses: [],
    nodes: [
        { id: "w1", title: "One of three", feature: "f", step: 1, path: ["Wide"] },
        { id: "w2", title: "Two of three", feature: "f", step: 2, path: ["Wide"] },
        { id: "w3", title: "Three of three", feature: "f", step: 3, path: ["Wide"] },
        { id: "s1", title: "Alone", feature: "f", step: 4, path: ["Narrow"] }
    ]
}, "f", {});

const wide = lopsided.bands.find(b => b.name === "Wide");
const narrow = lopsided.bands.find(b => b.name === "Narrow");

assert.ok(wide.minX < narrow.minX, "the wide band reaches further left than the narrow one");
assert.equal(
    narrow.minX,
    Math.min(...lopsided.nodes.filter(n => n.id === "s1").map(n => n.x)),
    "a band's left edge is its own cards, not the feature's"
);

// The rows the asides sit next to, so they align with what is beside them
// rather than with the widest row somewhere else.
assert.equal(lopsided.bottomRowX, wide.minX, "the bottom row is the wide one");
assert.equal(lopsided.topRowX, narrow.minX, "the top row is the narrow one");

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
