import assert from "node:assert/strict";

import {
    buildSpine,
    CARD_GAP,
    COLUMN_X,
    orderSteps,
    STEP_H
} from "../webview/model.js";

// --------------------------------------------------
// A FEATURE IS ONE STRAIGHT COLUMN
// --------------------------------------------------
// In `step` order, top to bottom, and nothing else moves a card: not the
// call graph, not a stored x/y, not the lens.
//
// It used to be laid out from edgesOut by longest path, so two steps that
// did not call each other were drawn side by side and a step with two
// callers fanned out. That drew the call graph and called it the plan.
// --------------------------------------------------

const step = (id, order, extra = {}) => ({
    id,
    feature: "f",
    identity: `src/a.js::${id}:function`,
    role: "behaviour",
    title: `Step ${id}`,
    intent: "x",
    step: order,
    lensTags: [],
    rules: [],
    edgesOut: [],
    status: "intended",
    origin: "ai_drafted",
    ...extra
});

const build = nodes =>
    buildSpine({ version: 1, lenses: [], features: [{ id: "f", name: "F" }], nodes }, "f", {});

const steps = spine => spine.items.filter(item => item.kind === "step");


// --------------------------------------------------
// NO LINKS AT ALL
// --------------------------------------------------

const plain = build([step("a", 1), step("b", 2), step("c", 3)]);

assert.equal(new Set(steps(plain).map(item => item.x)).size, 1, "one x");
assert.deepEqual(steps(plain).map(item => item.x), [COLUMN_X, COLUMN_X, COLUMN_X].map(() => steps(plain)[0].x));

const ys = steps(plain).map(item => item.y);
assert.deepEqual(ys, [...ys].sort((a, b) => a - b), "y increases down the column");
assert.equal(new Set(ys).size, 3, "one step to a row");

// Even spacing, because every card is the same height.
assert.ok(steps(plain).every(item => item.h === STEP_H));
assert.equal(ys[1] - ys[0], STEP_H + CARD_GAP);
assert.equal(ys[2] - ys[1], STEP_H + CARD_GAP);


// --------------------------------------------------
// BRANCHES AND MERGES ARE STILL ONE COLUMN
// --------------------------------------------------

const branchy = build([
    step("a", 1, { edgesOut: ["b", "c"] }),
    step("b", 2, { edgesOut: ["d"] }),
    step("c", 3, { edgesOut: ["d"] }),
    step("d", 4)
]);

assert.equal(new Set(steps(branchy).map(item => item.x)).size, 1, "a branch does not fan out");
assert.equal(new Set(steps(branchy).map(item => item.y)).size, 4, "and a merge does not share a row");
assert.deepEqual(steps(branchy).map(item => item.id), ["a", "b", "c", "d"]);

// A cycle is finite and stays in order.
const cyclic = build([
    step("a", 1, { edgesOut: ["b"] }),
    step("b", 2, { edgesOut: ["a"] })
]);

assert.deepEqual(steps(cyclic).map(item => item.id), ["a", "b"]);


// --------------------------------------------------
// STORED POSITIONS ARE IGNORED
// --------------------------------------------------
// A step used to be draggable anywhere and the position was written to the
// node, so the column stopped being an order.

const placed = build([
    step("a", 1, { x: 5000, y: 9000 }),
    step("b", 2, { x: -400, y: -800 })
]);

assert.equal(new Set(steps(placed).map(item => item.x)).size, 1);
assert.deepEqual(steps(placed).map(item => item.id), ["a", "b"]);
assert.ok(steps(placed)[0].y < steps(placed)[1].y, "the stored y is not honoured");


// --------------------------------------------------
// ORDER IS step, WITH TIES BY id
// --------------------------------------------------

assert.deepEqual(
    steps(build([step("z", 2), step("a", 1), step("m", 3)])).map(item => item.id),
    ["a", "z", "m"]
);

assert.deepEqual(
    orderSteps([step("b", 4), step("a", 4), step("c", 4)]).map(node => node.id),
    ["a", "b", "c"],
    "two steps numbered the same are separated by id"
);

// Steps the model never numbered come after the numbered ones, in the
// order the plan lists them.
assert.deepEqual(
    orderSteps([step("x"), step("b", 2), step("y"), step("a", 1)]).map(node => node.id),
    ["a", "b", "x", "y"]
);


// --------------------------------------------------
// SHUFFLING THE INPUT CHANGES NOTHING
// --------------------------------------------------

const nodes = Array.from({ length: 9 }, (_, at) => step(`n${at}`, at + 1, {
    edgesOut: at % 3 === 0 ? [`n${at + 1}`] : []
}));

const canonical = spine =>
    JSON.stringify(spine.items.map(item => [item.id, item.number, item.x, item.y]));

const reference = canonical(build(nodes));

function shuffled(list, seed) {
    const out = [...list];
    let cursor = seed;

    for (let at = out.length - 1; at > 0; at -= 1) {
        cursor = (cursor * 1103515245 + 12345) % 2147483648;
        const swap = cursor % (at + 1);
        [out[at], out[swap]] = [out[swap], out[at]];
    }

    return out;
}

for (const seed of [3, 77, 9001]) {
    assert.equal(canonical(build(shuffled(nodes, seed))), reference, `seed ${seed} changed the layout`);
}


// --------------------------------------------------
// NUMBERS ARE 1..N
// --------------------------------------------------
// What the reader is looking at, not what the plan calls it: `step` is
// only the sort key, and a plan whose numbers skip must not show gaps.

assert.deepEqual(
    steps(build([step("a", 10), step("b", 40), step("c", 90)])).map(item => item.number),
    ["1", "2", "3"]
);

assert.deepEqual(
    steps(build(nodes)).map(item => item.number),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
);


// --------------------------------------------------
// THE LINE JOINS NEIGHBOURS, AND MEANS "NEXT"
// --------------------------------------------------

assert.deepEqual(
    plain.links,
    [{ from: "a", to: "b" }, { from: "b", to: "c" }]
);

assert.equal(plain.flowLabel, "in step order");
assert.equal(build([]).links.length, 0);

console.log("PASS: spine-layout");
