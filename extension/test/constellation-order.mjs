import assert from "node:assert/strict";

import {
    buildConstellation,
    constellationEdges,
    CARD_GAP,
    FEATURE_H,
    roleOf
} from "../webview/model.js";

// --------------------------------------------------
// THE CONSTELLATION READS DOWNWARDS
// --------------------------------------------------
// It used to be stacked from the bottom up, so the journey climbed while
// the feature you opened from it ran down the page. One map, two
// directions, and a reader re-orienting at every click.
// --------------------------------------------------

const step = (id, feature, order) => ({
    id,
    feature,
    identity: `src/${id}.js::run:function`,
    role: "behaviour",
    title: `Step ${id}`,
    intent: "x",
    step: order,
    lensTags: [],
    rules: [],
    edgesOut: [],
    status: "intended",
    origin: "ai_drafted"
});

const plan = {
    version: 1,
    lenses: [],
    features: [
        { id: "login", name: "Login" },
        { id: "survey", name: "Survey" },
        { id: "reports", name: "Reports" }
    ],
    nodes: [
        step("a", "login", 1),
        step("b", "login", 2),
        step("c", "survey", 1),
        { ...step("d", "survey", 2), edgesOut: ["e"] },
        step("e", "reports", 1)
    ]
};

const built = buildConstellation(plan, {});


// --------------------------------------------------
// TOP TO BOTTOM, EQUAL HEIGHTS
// --------------------------------------------------

assert.deepEqual(built.cards.map(card => card.title), ["Login", "Survey", "Reports"]);
assert.deepEqual(built.cards.map(card => card.step), [1, 2, 3]);

const ys = built.cards.map(card => card.y);

assert.deepEqual(ys, [...ys].sort((a, b) => a - b), "the first feature is at the top");
assert.equal(new Set(built.cards.map(card => card.x)).size, 1, "one column");

assert.ok(built.cards.every(card => card.h === FEATURE_H), "every card the same height");
assert.ok(ys[1] - ys[0] >= FEATURE_H, "and none of them overlap");
assert.ok(ys[1] - ys[0] <= FEATURE_H + CARD_GAP);
assert.equal(ys[1] - ys[0], ys[2] - ys[1], "one fixed pitch");


// --------------------------------------------------
// A FEATURE WITH NO STEPS GETS NO CARD
// --------------------------------------------------
// Everything it holds goes into one folded row under the journey, because
// an empty box on a map is a thing to wonder about rather than read.

const withSetup = buildConstellation({
    ...plan,
    features: [...plan.features, { id: "infra", name: "Infrastructure" }],
    nodes: [
        ...plan.nodes,
        { id: "m1", feature: "infra", title: "Connect the pool", intent: "x", role: "machinery" },
        { id: "v1", feature: "infra", title: "Database settings", intent: "x", role: "vocabulary" }
    ]
}, {});

assert.deepEqual(withSetup.cards.map(card => card.title), ["Login", "Survey", "Reports"]);
assert.deepEqual(withSetup.cards.map(card => card.step), [1, 2, 3], "numbering skips the one with no card");

assert.equal(withSetup.setup.title, "Project setup");
assert.equal(withSetup.setup.count, 2);
assert.ok(withSetup.setup.y > withSetup.cards.at(-1).y, "the row sits under the journey");

assert.deepEqual(
    withSetup.setup.chips.map(chip => [chip.title, chip.role]),
    [["Connect the pool", "machinery"], ["Database settings", "vocabulary"]],
    "each chip says what kind of thing it is"
);

assert.equal(roleOf({ role: "machinery" }), "machinery");
assert.equal(built.setup, null, "nothing left over, no row");


// --------------------------------------------------
// ONLY THE ORDER LINE BY DEFAULT
// --------------------------------------------------
// A real link between two features - a step in one whose code calls a step
// in another - is drawn as an arc, and only while a card is selected.
// Drawing them all at once turns the journey back into a call graph.

assert.deepEqual(constellationEdges(plan), [
    { from: "survey", to: "reports", source: "nodes" },
    { from: "login", to: "survey", source: "order" }
]);

const real = constellationEdges(plan).filter(edge => edge.source === "nodes");

assert.equal(real.length, 1, "one genuine cross-feature call in this fixture");
assert.deepEqual(real[0], { from: "survey", to: "reports", source: "nodes" });

// What main.js does with them: only when something is selected.
const main = await import("node:fs").then(fs =>
    fs.readFileSync(new URL("../webview/main.js", import.meta.url), "utf8"));

assert.match(main, /const arcs = selected\s*\?\s*constellationEdges\(plan\(\)\)/, "arcs need a selection");
assert.match(main, /edge\.source === "nodes"/, "and only a real link is ever an arc");
assert.match(main, /kind: "order"/, "the order line is its own kind");
assert.match(main, /constellationFlowLabel\.textContent = "in the order a person meets them"/);

console.log("PASS: constellation-order");
