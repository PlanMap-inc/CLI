import assert from "node:assert/strict";

import { buildFeatureGraph, flowEdgePath, CARD_GAP, NODE_W } from "../webview/model.js";

// The Feature Flow reads top to bottom. A flow with no branch and no merge is
// ONE column - same x, even gaps, a straight connector between neighbours -
// and a real branch or merge keeps its shape.

const step = (id, title, order, edgesOut = []) =>
    ({ id, title, step: order, feature: "f", intent: "x", edgesOut });

const build = nodes =>
    buildFeatureGraph({ version: 1, lenses: [], features: [{ id: "f", name: "F" }], nodes }, "f", {});

const topToBottom = graph => [...graph.nodes].sort((a, b) => a.y - b.y);
const ids = graph => topToBottom(graph).map(n => n.id);
const gaps = graph => {
    const sorted = topToBottom(graph);
    return sorted.slice(1).map((n, i) => n.y - (sorted[i].y + sorted[i].h));
};
const numbers = path => path.match(/-?\d+(?:\.\d+)?/g).map(Number);

// --------------------------------------------------
// LOGIN, AS THE PLAN HAS IT
// --------------------------------------------------
// Four steps, and exactly one edge among them: registering the callback
// leads to the callback. Validate and Initiate call nothing and are called
// by nothing. Plan order is 3, 4, 5, 6.
const login = build([
    step("init", "Initialize Google ID and render button", 3, ["send"]),
    step("send", "Send token to backend securely", 4),
    step("validate", "Validate bearer token signature", 5),
    step("initiate", "Initiate authentication flow", 6)
]);

assert.deepEqual(ids(login), ["init", "validate", "initiate", "send"], "read top to bottom");
assert.equal(new Set(login.nodes.map(n => n.x)).size, 1, "all four share one vertical axis");
assert.deepEqual(gaps(login), [CARD_GAP, CARD_GAP, CARD_GAP], "even spacing between every neighbour");
assert.deepEqual(topToBottom(login).map(n => n.step), [1, 2, 3, 4], "numbered down the page");
assert.deepEqual(login.edges, [{ from: "init", to: "send" }], "the layout draws the edges the plan has, and no others");

// That one edge jumps over two cards. A straight line would run behind them
// and read as three edges that are not there, so it leaves the column.
const [top, , , bottom] = topToBottom(login);
const jump = numbers(flowEdgePath(top, bottom, login.nodes, NODE_W));
assert.ok(
    jump.filter((_, i) => i % 2 === 0).every(x => x >= top.x + NODE_W),
    "a connector that skips cards runs beside the column, not through it"
);

// --------------------------------------------------
// A CHAIN IS ALWAYS A COLUMN
// --------------------------------------------------
// The plan numbers these 4, 1, 3, 2. The links decide the order.
const chain = build([
    step("a", "A", 4, ["b"]),
    step("b", "B", 1, ["c"]),
    step("c", "C", 3, ["d"]),
    step("d", "D", 2)
]);

assert.deepEqual(ids(chain), ["a", "b", "c", "d"]);
assert.equal(new Set(chain.nodes.map(n => n.x)).size, 1);
assert.deepEqual(gaps(chain), [CARD_GAP, CARD_GAP, CARD_GAP]);
assert.equal(chain.edges.length, 3, "no edge added to make it vertical");
assert.equal(chain.topRowX, chain.nodes[0].x, "what sits above the flow lines up with it");
assert.equal(chain.bottomRowX, chain.nodes[0].x, "and so does what sits below");

// Neighbours are joined bottom to top by a straight vertical line: no elbow.
const sorted = topToBottom(chain);

for (let i = 1; i < sorted.length; i += 1) {
    const from = sorted[i - 1];
    const to = sorted[i];
    const [x1, y1, x2, y2] = numbers(flowEdgePath(from, to, chain.nodes, NODE_W));

    assert.equal(x1, x2, "vertical, never an L");
    assert.equal(x1, from.x + NODE_W / 2, "from the middle of the card");
    assert.equal(y1, from.y + from.h, "out of the bottom of one");
    assert.equal(y2, to.y, "into the top of the next");
}

// The same plan, listed in another order, is laid out the same way.
const shuffled = build([
    step("d", "D", 2),
    step("b", "B", 1, ["c"]),
    step("a", "A", 4, ["b"]),
    step("c", "C", 3, ["d"])
]);
assert.deepEqual(
    Object.fromEntries(shuffled.nodes.map(n => [n.id, [n.x, n.y]])),
    Object.fromEntries(chain.nodes.map(n => [n.id, [n.x, n.y]])),
    "positions depend on the graph, not on how it was listed"
);

// --------------------------------------------------
// A REAL BRANCH OR MERGE KEEPS ITS SHAPE
// --------------------------------------------------
const branch = build([
    step("a", "A", 1, ["b", "c"]),
    step("b", "B", 2),
    step("c", "C", 3)
]);
const at = (graph, id) => graph.nodes.find(n => n.id === id);

assert.ok(at(branch, "a").y < at(branch, "b").y, "the branch point sits above what it branches to");
assert.equal(at(branch, "b").y, at(branch, "c").y, "the two arms share a row");
assert.notEqual(at(branch, "b").x, at(branch, "c").x, "side by side");

const merge = build([
    step("b", "B", 1, ["d"]),
    step("c", "C", 2, ["d"]),
    step("d", "D", 3)
]);

assert.equal(at(merge, "b").y, at(merge, "c").y, "two inputs share a row");
assert.notEqual(at(merge, "b").x, at(merge, "c").x);
assert.ok(at(merge, "d").y > at(merge, "b").y, "and meet below it");
assert.equal(merge.edges.length, 2);

// --------------------------------------------------
// WITHOUT LINKS THERE IS NO FLOW TO STRAIGHTEN
// --------------------------------------------------
const set = build([step("x", "X", 1), step("y", "Y", 2), step("z", "Z", 3)]);
assert.equal(new Set(set.nodes.map(n => n.y)).size, 1, "steps with no links between them are a set, not a sequence");

// --------------------------------------------------
// DETERMINISM
// --------------------------------------------------
assert.equal(JSON.stringify(build([
    step("init", "Initialize Google ID and render button", 3, ["send"]),
    step("send", "Send token to backend securely", 4),
    step("validate", "Validate bearer token signature", 5),
    step("initiate", "Initiate authentication flow", 6)
]).nodes.map(n => [n.id, n.x, n.y])), JSON.stringify(login.nodes.map(n => [n.id, n.x, n.y])));

console.log("PASS: flow-layout");
