import assert from "node:assert/strict";

import { buildSpine, callArcs, callsChips, CHIP_TARGETS } from "../webview/model.js";

// --------------------------------------------------
// edgesOut MEANS ONE THING: CALLS
// --------------------------------------------------
// It is never the layout, because a call is not an order - four risk
// lookups that all call the same helper are siblings, not a sequence.
//
// It shows as a chip that names where the call goes, and as an arc in the
// gutter when the card is selected. A step folded away still gets named on
// the chip; it just has no arc to draw to.
// --------------------------------------------------

const step = (id, feature, order, edgesOut = []) => ({
    id,
    feature,
    identity: `src/${feature}.js::${id}:function`,
    role: "behaviour",
    title: `Step ${id}`,
    intent: "x",
    step: order,
    lensTags: [],
    rules: [],
    edgesOut,
    status: "intended",
    origin: "ai_drafted"
});

const plan = {
    version: 1,
    lenses: [],
    features: [{ id: "f", name: "Survey" }, { id: "g", name: "Login" }],
    nodes: [
        step("a", "f", 1, ["b"]),
        step("b", "f", 2, ["c", "d", "e", "x"]),
        step("c", "f", 3),
        step("d", "f", 4),
        step("e", "f", 5),
        step("x", "g", 1)
    ]
};

const spine = buildSpine(plan, "f", {});

const context = {
    numberById: spine.numberById,
    featureOfNode: new Map(plan.nodes.map(node => [node.id, node.feature])),
    featureNames: new Map(plan.features.map(feature => [feature.id, feature.name]))
};

const chips = id => callsChips(plan.nodes.find(node => node.id === id), context);


// --------------------------------------------------
// ONE CALL, IN THIS FEATURE
// --------------------------------------------------

assert.deepEqual(chips("a"), [{ kind: "calls", targets: ["b"], text: "→ calls 2" }]);


// --------------------------------------------------
// SEVERAL, AND ONE THAT LEAVES
// --------------------------------------------------
// Two numbers and a count, because a card is not a list; and the feature's
// NAME for the one that leaves, because its number means nothing here.

assert.deepEqual(chips("b"), [
    { kind: "calls", targets: ["c", "d", "e"], text: "→ calls 3, 4 +1" },
    { kind: "exit", feature: "g", text: "↗ Login" }
]);

assert.equal(CHIP_TARGETS, 2, "two numbers is what fits beside a title");


// --------------------------------------------------
// NOTHING TO SAY
// --------------------------------------------------

assert.deepEqual(chips("c"), [], "a step that calls nothing carries no chip");

assert.deepEqual(
    callsChips({ id: "a", edgesOut: ["a"] }, context),
    [],
    "a step calling itself is one step, not a relationship"
);

assert.deepEqual(callsChips({}, context), []);
assert.deepEqual(callsChips({ edgesOut: ["gone"] }, context), [], "a target nothing holds is not drawn");

// One chip per feature it leaves to, however many calls go there.
assert.deepEqual(
    callsChips({ id: "z", edgesOut: ["x", "x"] }, context),
    [{ kind: "exit", feature: "g", text: "↗ Login" }]
);


// --------------------------------------------------
// ARCS, AND ONLY FOR THE SELECTED CARD
// --------------------------------------------------

assert.deepEqual(callArcs(null, spine.items, plan), [], "nothing selected, nothing drawn");

assert.deepEqual(
    callArcs("b", spine.items, plan),
    [
        { from: "b", to: "c", direction: "out" },
        { from: "b", to: "d", direction: "out" },
        { from: "b", to: "e", direction: "out" },
        { from: "a", to: "b", direction: "in" }
    ],
    "out to what it calls, in from what calls it - and never across a feature"
);

assert.deepEqual(
    callArcs("c", spine.items, plan),
    [{ from: "b", to: "c", direction: "in" }],
    "a step that calls nothing still shows what reaches it"
);


// --------------------------------------------------
// A FOLDED-AWAY STEP GETS NO ARC
// --------------------------------------------------
// The chip still names it, because the reader needs to know the call is
// there. There is simply nowhere on the canvas to draw it to.

const big = {
    ...plan,
    nodes: [
        ...Array.from({ length: 14 }, (_, at) => step(`p${at}`, "f", at + 10, at === 0 ? ["c"] : [])),
        ...plan.nodes
    ]
};

const folded = buildSpine(big, "f", {});

assert.equal(folded.folded, true, "the fixture must fold");

const visible = new Set(folded.items.filter(item => item.kind === "step").map(item => item.id));

assert.ok(!visible.has("c"), "c is behind a part row");
assert.deepEqual(callArcs("p0", folded.items, big), [], "so no arc is drawn to it");

// And the chip still names it, by the number it has when it is on screen.
assert.deepEqual(
    callsChips(big.nodes.find(node => node.id === "p0"), {
        numberById: folded.numberById,
        featureOfNode: context.featureOfNode,
        featureNames: context.featureNames
    }),
    [{ kind: "calls", targets: ["c"], text: `→ calls ${folded.numberById.get("c")}` }]
);

console.log("PASS: calls-chip");
