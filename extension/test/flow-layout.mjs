import assert from "node:assert/strict";

import { buildSpine, callsChips, CARD_GAP, STEP_H } from "../webview/model.js";

// --------------------------------------------------
// THE SHAPES THAT USED TO FAN OUT
// --------------------------------------------------
// This suite used to check that the layout read the call graph: a branch
// spread side by side, a merge met below, and steps that called nothing
// shared a row as "a set".
//
// It drew the call graph and called it the plan. Worse, `edgesOut` meant
// two things - the draft wrote it as calls and `plan order` wrote it as an
// order chain - so the same field decided the layout under two different
// meanings depending on what had last touched the file.
//
// Every fixture below is kept, and every one of them is now one column in
// `step` order. The calls are still shown, as a chip on the card.
// --------------------------------------------------

const step = (id, title, order, edgesOut = []) =>
    ({ id, title, step: order, feature: "f", intent: "x", edgesOut });

const build = nodes =>
    buildSpine({ version: 1, lenses: [], features: [{ id: "f", name: "F" }], nodes }, "f", {});

const steps = spine => spine.items.filter(item => item.kind === "step");
const topToBottom = spine => [...steps(spine)].sort((a, b) => a.y - b.y);
const ids = spine => topToBottom(spine).map(item => item.id);

const gaps = spine => {
    const sorted = topToBottom(spine);
    return sorted.slice(1).map((item, at) => item.y - (sorted[at].y + sorted[at].h));
};


// --------------------------------------------------
// LOGIN, AS THE PLAN HAS IT
// --------------------------------------------------
// Four steps, and exactly one call among them. Plan order is 3, 4, 5, 6,
// and plan order is now the whole layout: the call no longer reorders
// anything, so "send" stays where its number puts it.

const login = build([
    step("init", "Initialize Google ID and render button", 3, ["send"]),
    step("send", "Send token to backend securely", 4),
    step("validate", "Validate bearer token signature", 5),
    step("initiate", "Initiate authentication flow", 6)
]);

assert.deepEqual(ids(login), ["init", "send", "validate", "initiate"], "read top to bottom, in step order");
assert.equal(new Set(steps(login).map(item => item.x)).size, 1, "all four share one vertical axis");
assert.deepEqual(gaps(login), [CARD_GAP, CARD_GAP, CARD_GAP], "even spacing between every neighbour");
assert.deepEqual(topToBottom(login).map(item => item.number), ["1", "2", "3", "4"], "numbered down the page");
assert.ok(steps(login).every(item => item.h === STEP_H), "and every card the same height");

// The line joins neighbours, in order, and nothing else.
assert.deepEqual(
    login.links,
    [{ from: "init", to: "send" }, { from: "send", to: "validate" }, { from: "validate", to: "initiate" }],
    "the line is the order, not the calls"
);

// The call is still there. It is on the card, naming where it goes.
assert.deepEqual(
    callsChips(login.items[0].node, { numberById: login.numberById }),
    [{ kind: "calls", targets: ["send"], text: "→ calls 2" }]
);


// --------------------------------------------------
// A CHAIN IS A COLUMN, AND SO IS EVERYTHING ELSE
// --------------------------------------------------
// The plan numbers these 4, 1, 3, 2, and the numbers decide the order.
// The links used to.

const chain = build([
    step("a", "A", 4, ["b"]),
    step("b", "B", 1, ["c"]),
    step("c", "C", 3, ["d"]),
    step("d", "D", 2)
]);

assert.deepEqual(ids(chain), ["b", "d", "c", "a"], "step order, not call order");
assert.equal(new Set(steps(chain).map(item => item.x)).size, 1);
assert.deepEqual(gaps(chain), [CARD_GAP, CARD_GAP, CARD_GAP]);

// The same plan, listed in another order, is laid out the same way.
const shuffled = build([
    step("d", "D", 2),
    step("b", "B", 1, ["c"]),
    step("a", "A", 4, ["b"]),
    step("c", "C", 3, ["d"])
]);

assert.deepEqual(
    Object.fromEntries(steps(shuffled).map(item => [item.id, [item.x, item.y]])),
    Object.fromEntries(steps(chain).map(item => [item.id, [item.x, item.y]])),
    "positions depend on the order the plan gives, not on how it was listed"
);


// --------------------------------------------------
// A BRANCH IS STILL A COLUMN
// --------------------------------------------------
// It used to spread side by side. Two steps that a third calls are not
// two arms of anything - four risk lookups that all call one helper are
// siblings, and drawing them as a fork says something the code does not.

const branch = build([
    step("a", "A", 1, ["b", "c"]),
    step("b", "B", 2),
    step("c", "C", 3)
]);

assert.equal(new Set(steps(branch).map(item => item.x)).size, 1, "no fan-out");
assert.deepEqual(ids(branch), ["a", "b", "c"]);
assert.equal(new Set(steps(branch).map(item => item.y)).size, 3, "one step to a row");

assert.deepEqual(
    callsChips(branch.items[0].node, { numberById: branch.numberById }),
    [{ kind: "calls", targets: ["b", "c"], text: "→ calls 2, 3" }],
    "the branch is on the card instead"
);


// --------------------------------------------------
// A MERGE IS STILL A COLUMN
// --------------------------------------------------

const merge = build([
    step("b", "B", 1, ["d"]),
    step("c", "C", 2, ["d"]),
    step("d", "D", 3)
]);

assert.equal(new Set(steps(merge).map(item => item.x)).size, 1);
assert.deepEqual(ids(merge), ["b", "c", "d"]);
assert.equal(new Set(steps(merge).map(item => item.y)).size, 3, "two inputs no longer share a row");


// --------------------------------------------------
// AND SO IS A SET
// --------------------------------------------------
// Steps with no links between them used to share one row, on the grounds
// that they were a set rather than a sequence. They are still a set - the
// line says only "next in this feature" - but they read down the page,
// because everything does.

const set = build([step("x", "X", 1), step("y", "Y", 2), step("z", "Z", 3)]);

assert.equal(new Set(steps(set).map(item => item.y)).size, 3, "one to a row");
assert.equal(new Set(steps(set).map(item => item.x)).size, 1);
assert.equal(set.links.length, 2, "joined in order, with nothing claimed about cause");


// --------------------------------------------------
// STORED POSITIONS ARE IGNORED
// --------------------------------------------------
// A step could be dragged anywhere and the position was written to the
// node. The column is the order now, so x and y on a node mean nothing.

const placed = build([
    { ...step("a", "A", 1), x: 4000, y: -900 },
    { ...step("b", "B", 2), x: -50, y: 12000 }
]);

assert.equal(new Set(steps(placed).map(item => item.x)).size, 1, "a stored x is ignored");
assert.deepEqual(ids(placed), ["a", "b"], "and so is a stored y");


// --------------------------------------------------
// DETERMINISM
// --------------------------------------------------

assert.equal(
    JSON.stringify(build([
        step("init", "Initialize Google ID and render button", 3, ["send"]),
        step("send", "Send token to backend securely", 4),
        step("validate", "Validate bearer token signature", 5),
        step("initiate", "Initiate authentication flow", 6)
    ]).items.map(item => [item.id, item.x, item.y])),
    JSON.stringify(login.items.map(item => [item.id, item.x, item.y]))
);

console.log("PASS: flow-layout");
