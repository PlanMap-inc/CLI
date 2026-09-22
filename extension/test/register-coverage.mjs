import assert from "node:assert/strict";

import {
    buildConstellation,
    buildSpine,
    featureRegisters,
    nodesInFeature,
    nodeSub,
    orderedSteps,
    roleOf,
    ROLE_IDS
} from "../webview/model.js";

// --------------------------------------------------
// NOTHING IS LOST
// --------------------------------------------------
// The whole abstraction rests on one promise: a declaration that stops being
// drawn as a step is still reachable, in one click, from the feature it
// belongs to. If that ever stops being true, the graph is hiding code rather
// than explaining it, and no amount of coherence is worth that.
// --------------------------------------------------

const plan = {
    version: 1,
    lenses: [{ id: "backend", label: "Backend" }, { id: "database", label: "Database" }],
    features: [{ id: "risk", name: "Compute Risk" }, { id: "fetch", name: "Fetch Data" }],
    nodes: [
        // Steps, in two bands.
        { id: "s1", title: "Open the risk tables from disk", feature: "risk", step: 1, path: ["Load"], role: "behaviour", identity: "s.py::load:function", edgesOut: ["s2"] },
        { id: "s2", title: "Look up the risk score for any scope", feature: "risk", step: 2, path: ["Lookups"], role: "behaviour",
          identity: "s.py::agency_risk:function",
          identities: ["s.py::agency_risk:function", "s.py::mp_risk:function", "s.py::state_risk:function"],
          dimensions: ["agency", "MP", "state"], edgesOut: [] },
        { id: "s3", title: "Check a district's state boundary", feature: "risk", step: 3, path: ["Lookups"], role: "behaviour", identity: "s.py::boundary:function", edgesOut: [] },
        { id: "s4", title: "Assemble the risk table views", feature: "risk", step: 4, path: ["Aggregation"], role: "behaviour", identity: "s.py::tables:function", edgesOut: [] },

        // Beside the spine.
        { id: "v1", title: "The three allowed columns", feature: "risk", step: 5, role: "vocabulary", identity: "s.py::COLS:data" },
        { id: "v2", title: "The two Lok Sabha scopes", feature: "risk", step: 6, role: "vocabulary", identity: "s.py::SCOPES:data" },
        { id: "m1", title: "Open the CSV store", feature: "risk", step: 7, role: "machinery", identity: "s.py::get_store:function" },
        { id: "t1", title: "Fold a name to its sort key", feature: "risk", step: 8, role: "tool", identity: "s.py::clean:function" },

        { id: "f1", title: "Read the report directory", feature: "fetch", step: 1, role: "behaviour", identity: "a.py::grab:function" }
    ]
};

for (const feature of plan.features) {
    const members = nodesInFeature(plan, feature.id);
    const registers = featureRegisters(plan, feature.id);

    const drawn = [
        ...registers.spine,
        ...registers.vocabulary,
        ...registers.machinery,
        ...registers.tools
    ];

    assert.equal(
        drawn.length,
        members.length,
        `${feature.name}: every node is drawn somewhere`
    );

    assert.deepEqual(
        drawn.map(node => node.id).sort(),
        members.map(node => node.id).sort(),
        `${feature.name}: the same nodes, no duplicates and no losses`
    );

    // And each in exactly one register.
    const seen = new Map();
    for (const register of ["spine", "vocabulary", "machinery", "tools"]) {
        for (const node of registers[register]) {
            assert.ok(!seen.has(node.id), `${node.id} is drawn twice`);
            seen.set(node.id, register);
        }
    }
}

// Every DECLARATION, not just every node: a merged step must account for all
// of the declarations behind it, or the merge has swallowed code.
const declarations = plan.nodes.flatMap(node =>
    Array.isArray(node.identities) ? node.identities : [node.identity]);

assert.equal(new Set(declarations).size, declarations.length, "no declaration is claimed by two nodes");
assert.equal(declarations.length, 11, "three of the eleven reach the reader through one merged step");

// --------------------------------------------------
// THE SPINE IS SHORTER THAN THE FEATURE, AND HONESTLY SO
// --------------------------------------------------

const spine = buildSpine(plan, "risk", {});
const steps = spine.items.filter(item => item.kind === "step");

assert.equal(steps.length, 4, "four steps drawn");
assert.equal(nodesInFeature(plan, "risk").length, 8, "out of eight nodes");

assert.equal(
    steps.reduce((total, item) => total + (item.node.identities?.length ?? 1), 0),
    6,
    "the four steps stand for six declarations between them"
);

// The merged step says so, on its code line.
const merged = steps.find(item => item.id === "s2");
assert.equal(merged.node.identities.length, 3);
assert.match(nodeSub(merged.node), /^3 declarations/);

// --------------------------------------------------
// TERMS, PRECONDITIONS AND HELPERS ARE NOT ON THE LINE
// --------------------------------------------------
// They are rows in the column - "Terms · 1" above the steps, "Runs on"
// and "Helpers" below - and the order line skips them, because they are
// what the steps are written in rather than things the system does.

const registers = spine.items.filter(item => item.kind === "register");

assert.ok(registers.length > 0, "the feature's other registers are drawn as rows");
assert.ok(registers.every(row => row.offLine), "and never sit on the order line");

const onLine = spine.items.filter(item => !item.offLine).map(item => item.id);

for (const link of spine.links) {
    assert.ok(onLine.includes(link.from) && onLine.includes(link.to),
        "the line only joins things that are on it");
}

// Every step is on the canvas: four steps is under FLAT_LIMIT, so the
// feature reads flat with no part rows in front of anything.
assert.equal(spine.folded, false, "four steps is under FLAT_LIMIT");
assert.deepEqual(spine.parts, []);

assert.equal(
    steps.length,
    featureRegisters(plan, "risk").spine.length,
    "an unfolded feature draws every step, never a subset"
);

// --------------------------------------------------
// ONE COLUMN, WHATEVER THE CODE CALLS
// --------------------------------------------------
// s1 calls s2, and that changes nothing about where either sits. The
// layout is `step` order and only that; the call shows as a chip and, on
// the selected card, as an arc.

assert.equal(new Set(steps.map(item => item.x)).size, 1, "one column");
assert.equal(new Set(steps.map(item => item.y)).size, steps.length, "one step to a row");

assert.deepEqual(
    steps.map(item => item.id),
    orderedSteps(plan, "risk").map(node => node.id),
    "in step order"
);

assert.deepEqual(
    steps.map(item => item.number),
    ["1", "2", "3", "4"],
    "numbered by position, 1..N"
);

// --------------------------------------------------
// THE CARD MATCHES WHAT IT OPENS
// --------------------------------------------------
// The first lines on the Constellation card are the first steps of the view
// it opens, in the same order, so nothing appears from nowhere.

const card = buildConstellation(plan, {}).cards.find(node => node.id === "risk");

assert.equal(card.count, 4, "the card counts steps, not every declaration");
assert.equal(card.sub, "4 steps", "four steps is under FLAT_LIMIT, so the card claims no parts");
assert.deepEqual(
    card.preview.map(step => step.title),
    ["Open the risk tables from disk", "Check a district's state boundary", "Assemble the risk table views"],
    "a sample of the real spine: it opens where the feature opens, ends where it ends, and samples between"
);
assert.ok(
    card.preview.every(step => steps.some(item => item.node.title === step.title)),
    "every previewed line is a step the feature really has"
);

// --------------------------------------------------
// AN OLD PLAN IS UNCHANGED
// --------------------------------------------------
// No node in a plan drafted before roles existed carries one, and all of
// them were steps. All of them still are.

const legacy = {
    features: [{ id: "f", name: "F" }],
    lenses: [],
    nodes: [
        { id: "a", title: "One", feature: "f", identity: "x.js::a:function", edgesOut: ["b"] },
        { id: "b", title: "Two", feature: "f", identity: "x.js::b:function", edgesOut: [] }
    ]
};

assert.equal(featureRegisters(legacy, "f").spine.length, 2);

const old = buildSpine(legacy, "f", {});

assert.equal(old.items.filter(item => item.kind === "step").length, 2);
assert.equal(old.folded, false, "two steps do not fold");
assert.ok(old.items.every(item => (item.node?.identities?.length ?? 1) === 1));

// No step numbers either: they fall to the end in plan order, and are
// still numbered by position.
assert.deepEqual(old.items.map(item => item.number), ["1", "2"]);

// The webview's role list matches the one the backend writes.
assert.deepEqual(ROLE_IDS, ["behaviour", "vocabulary", "machinery", "tool"]);
assert.equal(roleOf({}), "behaviour");

console.log("PASS: register-coverage");
