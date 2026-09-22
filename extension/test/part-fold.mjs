import assert from "node:assert/strict";

import {
    buildSpine,
    FLAT_LIMIT,
    nextDrift,
    partsOf,
    RANGE_SIZE
} from "../webview/model.js";

// --------------------------------------------------
// A BIG FEATURE OPENS FOLDED
// --------------------------------------------------
// Past a dozen steps a feature stops being something you read and becomes
// something you scroll. It folds by the part the outline already gave each
// step - so the fold follows a grouping somebody made, rather than one the
// view invented - and opening a part unfolds its steps in place.
//
// This replaces the lanes, which labelled a banded column off to one side
// and left every card on screen at once.
// --------------------------------------------------

const step = (id, order, part, extra = {}) => ({
    id,
    feature: "f",
    identity: `src/a.js::${id}:function`,
    role: "behaviour",
    title: `Step ${id}`,
    intent: "x",
    step: order,
    ...(part === null ? {} : { path: [part] }),
    lensTags: [],
    rules: [],
    edgesOut: [],
    status: "intended",
    origin: "ai_drafted",
    ...extra
});

const planOf = nodes => ({
    version: 1,
    lenses: [{ id: "security", label: "Security" }],
    features: [{ id: "f", name: "F" }],
    nodes
});

const build = (nodes, options = {}) => buildSpine(planOf(nodes), "f", options);
const kinds = spine => spine.items.map(item => item.kind);
const steps = spine => spine.items.filter(item => item.kind === "step");


// --------------------------------------------------
// THE THRESHOLD
// --------------------------------------------------

const PARTS = ["Fetch", "Transform", "Write"];
const many = Array.from({ length: 18 }, (_, at) => step(`n${at}`, at + 1, PARTS[Math.floor(at / 6)]));

assert.equal(build(many.slice(0, FLAT_LIMIT)).folded, false, `${FLAT_LIMIT} steps reads flat`);
assert.equal(build(many.slice(0, FLAT_LIMIT + 1)).folded, true, "one more folds");

const folded = build(many);

assert.equal(folded.flowLabel, "in step order · folded by part");
assert.deepEqual(kinds(folded), ["part", "part", "part"], "one row per part, and nothing else");
assert.deepEqual(folded.items.map(row => row.name), ["Fetch", "Transform", "Write"], "in the order their first step comes");
assert.deepEqual(folded.items.map(row => row.count), [6, 6, 6]);
assert.deepEqual(folded.items.map(row => row.number), ["1", "2", "3"]);


// --------------------------------------------------
// PARTS ARE ORDERED BY THEIR EARLIEST STEP
// --------------------------------------------------
// Not by size, and not by the order the plan happens to list them.

const interleaved = build([
    step("a", 1, "Write"),
    ...Array.from({ length: 12 }, (_, at) => step(`b${at}`, at + 2, "Read")),
    step("c", 20, "Shape")
]);

assert.deepEqual(
    interleaved.parts.map(part => part.name),
    ["Write", "Read", "Shape"],
    "Write holds one step and still comes first, because its step does"
);

// A part holding one step is drawn as that step's card, not as a row -
// a row you click to reveal one card is a door in front of nothing.
assert.equal(interleaved.items[0].kind, "step");
assert.equal(interleaved.items[0].number, "1", "and it takes the part's own number");
assert.equal(interleaved.items[1].kind, "part");


// --------------------------------------------------
// "OTHER STEPS" IS ALWAYS LAST
// --------------------------------------------------
// It is not a stage of anything; it is what is left.

const unplaced = build([
    ...Array.from({ length: 7 }, (_, at) => step(`u${at}`, at + 1, null)),
    ...Array.from({ length: 7 }, (_, at) => step(`p${at}`, at + 10, "Fetch"))
]);

assert.deepEqual(unplaced.parts.map(part => part.name), ["Fetch", "Other steps"]);

assert.deepEqual(
    partsOf([step("a", 1, null), step("b", 2, "Read")]).map(part => part.name),
    ["Read", "Other steps"],
    "even when the unplaced steps came first"
);


// --------------------------------------------------
// ONE PART IS NOT A GROUPING
// --------------------------------------------------
// It is the feature. A feature the outline put under one heading folds
// into ranges instead, which at least tells the reader where they are.

const single = build(Array.from({ length: 25 }, (_, at) => step(`s${at}`, at + 1, "Everything")));

assert.deepEqual(
    single.parts.map(part => part.name),
    ["Steps 1–10", "Steps 11–20", "Steps 21–25"]
);
assert.equal(single.parts[0].nodes.length, RANGE_SIZE);
assert.equal(single.parts.at(-1).nodes.length, 5);


// --------------------------------------------------
// ONLY ONE PART IS OPEN AT A TIME
// --------------------------------------------------

const open = build(many, { openPart: "part:Transform" });

assert.deepEqual(
    kinds(open),
    ["part", "part", "step", "step", "step", "step", "step", "step", "part"],
    "the open part's steps sit right below its row"
);

assert.deepEqual(
    steps(open).map(item => item.number),
    ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"],
    "numbered part.step"
);

assert.equal(open.items[1].open, true);
assert.equal(open.items[0].open, false);
assert.equal(open.items.at(-1).open, false);

// The column still reads downwards with the part open.
const openYs = open.items.map(item => item.y);
assert.deepEqual(openYs, [...openYs].sort((a, b) => a - b));

// Every step knows which part holds it, open or not.
assert.equal(folded.partIdByNode.get("n0"), "part:Fetch");
assert.equal(folded.partIdByNode.get("n13"), "part:Write");


// --------------------------------------------------
// DRIFT IS NEVER HIDDEN
// --------------------------------------------------
// A part row carries the failing count of what it holds, so folding can
// never make a problem invisible.

const verified = {
    "src/a.js::n7:function": { status: "drifted", verifiedAgainst: "n7@1" },
    "src/a.js::n13:function": { status: "error", verifiedAgainst: "n13@1" }
};

const drifting = build(
    many.map(node => ({ ...node, status: "approved", version: 1 })),
    { verifiedStatus: verified }
);

const rows = drifting.items.filter(item => item.kind === "part");

assert.deepEqual(rows.map(row => row.failing), [0, 1, 1], "each row counts its own");
assert.deepEqual(rows.map(row => row.status), ["approved", "drifted", "error"], "and carries the worst");

// Next drift walks them in order, and wraps.
assert.deepEqual(drifting.drifts, ["n7", "n13"]);
assert.equal(nextDrift(drifting.drifts, null), "n7");
assert.equal(nextDrift(drifting.drifts, "n7"), "n13");
assert.equal(nextDrift(drifting.drifts, "n13"), "n7", "and round again");
assert.equal(nextDrift([], "n7"), null, "a clean feature has none");

// A drifted step behind a lens fold is still findable: the part opens,
// the fold names it, and opening the fold brings it back.
const hidden = build(
    many.map(node => ({
        ...node,
        status: "approved",
        version: 1,
        lensTags: node.id === "n7" ? [] : ["security"]
    })),
    { verifiedStatus: verified, lensId: "security", openPart: "part:Transform" }
);

const foldId = hidden.hiddenIn.get("n7");

assert.ok(foldId, "the drifted step is behind a named fold row");
assert.ok(hidden.items.some(item => item.id === foldId));

const revealed = build(
    many.map(node => ({
        ...node,
        status: "approved",
        version: 1,
        lensTags: node.id === "n7" ? [] : ["security"]
    })),
    { verifiedStatus: verified, lensId: "security", openPart: "part:Transform", openFolds: [foldId] }
);

assert.ok(steps(revealed).some(item => item.id === "n7"), "opening the fold brings it back");

console.log("PASS: part-fold");
