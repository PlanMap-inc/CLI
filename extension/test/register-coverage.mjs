import assert from "node:assert/strict";

import {
    bandsOf,
    buildConstellation,
    buildFeatureGraph,
    featureRegisters,
    nodesInFeature,
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

const graph = buildFeatureGraph(plan, "risk", {});

assert.equal(graph.nodes.length, 4, "four steps drawn");
assert.equal(nodesInFeature(plan, "risk").length, 8, "out of eight nodes");
assert.equal(
    graph.nodes.reduce((total, node) => total + node.backing, 0),
    6,
    "the four steps stand for six declarations between them"
);

// The merged step says so.
const merged = graph.nodes.find(node => node.id === "s2");
assert.equal(merged.backing, 3);
assert.deepEqual(merged.dimensions, ["agency", "MP", "state"]);

// --------------------------------------------------
// FOUR STEPS IS TOO SHORT TO BAND
// --------------------------------------------------
// Banding exists to make a long spine manageable. Four steps read as one
// flow on their own, however many headings the outline gave them, so no
// lanes are drawn - "Load", "Lookups" and "Aggregation" stay path headings
// on the nodes, never a positional split. Real banding, on a spine long
// enough to need it, is covered in plan-render.mjs.

assert.deepEqual(graph.bands, [], "four steps is under FLAT_LIMIT, so nothing bands");

// Every step is on the canvas regardless - a lane labels what you can see,
// where the middle level used to hide it behind a card, and dropping the
// lane must not drop the step.
assert.equal(
    graph.nodes.length,
    featureRegisters(plan, "risk").spine.length,
    "no banding still draws every step, never a subset"
);

// s1 leads to s2, so s2 sits in the layer below it - a real edge, honoured
// now that it is not truncated at a band boundary the way it used to be.
assert.deepEqual(graph.edges, [{ from: "s1", to: "s2" }]);
const s1 = graph.nodes.find(n => n.id === "s1");
const s2 = graph.nodes.find(n => n.id === "s2");
assert.ok(s2.y > s1.y, "s2 sits below s1, the step it follows");

// One link, and nothing branching or merging: the flow is a single column,
// so s3 and s4 stack with the rest instead of fanning out beside s1. They
// still get no arrow - the layout draws the links the code has and no
// others. flow-layout.mjs covers the shapes this rule does and does not
// apply to.
assert.equal(new Set(graph.nodes.map(node => node.x)).size, 1, "no branch, so one column");
assert.equal(new Set(graph.nodes.map(node => node.y)).size, graph.nodes.length, "one step to a row");

// --------------------------------------------------
// THE CARD MATCHES WHAT IT OPENS
// --------------------------------------------------
// The first lines on the Constellation card are the first steps of the view
// it opens, in the same order, so nothing appears from nowhere.

const card = buildConstellation(plan, {}).find(node => node.id === "risk");

assert.equal(card.count, 4, "the card counts steps, not every declaration");
assert.equal(card.sub, "4 steps", "four steps is under FLAT_LIMIT, so the card does not claim parts that are never drawn as lanes");
assert.deepEqual(
    card.preview.map(step => step.title),
    ["Open the risk tables from disk", "Check a district's state boundary", "Assemble the risk table views"],
    "a sample of the real spine: it opens where the feature opens, ends where it ends, and samples between"
);
assert.ok(
    card.preview.every(step => graph.nodes.some(node => node.plainTitle === step.title)),
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
assert.equal(buildFeatureGraph(legacy, "f", {}).nodes.length, 2);
assert.deepEqual(buildFeatureGraph(legacy, "f", {}).bands, [], "no headings, no lanes");
assert.ok(buildFeatureGraph(legacy, "f", {}).nodes.every(node => node.backing === 1));

// The webview's role list matches the one the backend writes.
assert.deepEqual(ROLE_IDS, ["behaviour", "vocabulary", "machinery", "tool"]);
assert.equal(roleOf({}), "behaviour");

console.log("PASS: register-coverage");
