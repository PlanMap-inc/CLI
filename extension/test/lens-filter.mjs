import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    FEATURE_PALETTE,
    LENS_IDS,
    LENS_PALETTE,
    buildConstellation,
    buildFeatureGraph,
    colorAt,
    lensColors
} from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Filtering on lensTags: a lens shows only its nodes, and edges between them.
const plan = {
    features: [{ id: "f", name: "F" }],
    nodes: [
        { id: "n1", feature: "f", lensTags: ["security", "backend"], edgesOut: ["n2"] },
        { id: "n2", feature: "f", lensTags: ["backend"], edgesOut: ["n3"] },
        { id: "n3", feature: "f", lensTags: [], edgesOut: [] },
        { id: "n4", feature: "f" }
    ]
};
// A lens is a reading of the journey, not a filter over it: the same steps,
// in the same places, whichever lens is on. Only which ones the lens speaks
// to changes, so a reader can see what is being left out.
const ids = lensId => buildFeatureGraph(plan, "f", {}, lensId).nodes.map(n => n.id).sort();

assert.deepEqual(ids("security"), ["n1", "n2", "n3", "n4"]);
assert.deepEqual(ids("backend"), ["n1", "n2", "n3", "n4"]);
assert.deepEqual(ids(null), ["n1", "n2", "n3", "n4"], "every lens shows every step");

// Nothing is dimmed or dropped: a lens that has no words for a step leaves
// the step exactly as it was, at full strength, under its own name.
for (const lensId of ["security", "backend", null]) {
    const graph = buildFeatureGraph(plan, "f", {}, lensId);
    assert.equal(graph.nodes.length, 4, `${lensId} lost a step`);
    assert.ok(graph.nodes.every(node => node.renamed === false), "no readings in this fixture, so nothing is renamed");
}

// The shape never moves: same layout, same edges, whichever lens is on.
const shape = lensId => {
    const graph = buildFeatureGraph(plan, "f", {}, lensId);
    return JSON.stringify([graph.nodes.map(n => [n.id, n.x, n.y]), graph.edges]);
};
assert.equal(shape("security"), shape(null), "a lens never moves a step");
assert.equal(shape("backend"), shape(null));

// And it never breaks the chain: the journey stays joined end to end.
assert.equal(buildFeatureGraph(plan, "f", {}, "security").edges.length, buildFeatureGraph(plan, "f", {}).edges.length);

// --------------------------------------------------
// A LENS RENAMES, IT DOES NOT RESTRUCTURE
// --------------------------------------------------
// The same step said in each perspective's language: same node, same place,
// same rules, different words. A step the lens has no reading for keeps its
// own title rather than being given an invented one.

const readable = {
    features: [{ id: "g", name: "G" }],
    nodes: [
        {
            id: "r1", feature: "g", title: "Sign in with Google",
            lensTags: ["frontend", "security"], edgesOut: ["r2"],
            readings: {
                frontend: "Press the Google sign-in button",
                security: "Hand Google's token over to be checked"
            }
        },
        { id: "r2", feature: "g", title: "Save the answers", lensTags: ["database"], readings: { database: "INSERT one row per answer" } }
    ]
};

const titleAt = lensId =>
    Object.fromEntries(buildFeatureGraph(readable, "g", {}, lensId).nodes.map(n => [n.id, n.title]));

assert.deepEqual(titleAt(null), { r1: "Sign in with Google", r2: "Save the answers" }, "no lens: the plain titles");
assert.deepEqual(titleAt("frontend"), { r1: "Press the Google sign-in button", r2: "Save the answers" }, "the lens renames what it has a reading for, and leaves the rest alone");
assert.deepEqual(titleAt("security"), { r1: "Hand Google's token over to be checked", r2: "Save the answers" });
assert.deepEqual(titleAt("database"), { r1: "Sign in with Google", r2: "INSERT one row per answer" });

// The plain title travels with the node, so a panel can show both.
assert.deepEqual(
    buildFeatureGraph(readable, "g", {}, "frontend").nodes.map(n => n.plainTitle),
    ["Sign in with Google", "Save the answers"]
);

// Renaming never moves anything: same ids, same places, same edges.
const frame = lensId => {
    const graph = buildFeatureGraph(readable, "g", {}, lensId);
    return JSON.stringify([graph.nodes.map(n => [n.id, n.x, n.y]), graph.edges]);
};
for (const lensId of [null, "frontend", "security", "database"]) {
    assert.equal(frame(lensId), frame(null), `${lensId} moved a step`);
}

// A lens outside PlanMap's vocabulary is coloured by its position.
const django = { lenses: [{ id: "models", label: "Models" }, { id: "views", label: "Views" }, { id: "tasks", label: "Tasks" }] };
assert.deepEqual(lensColors(django), { models: LENS_PALETTE[0], views: LENS_PALETTE[1], tasks: LENS_PALETTE[2] });

// One in the vocabulary is coloured by its place there instead, wherever the
// plan happens to list it: the same perspective must be the same colour in
// the Plan Graph and in Project Evolution, which orders tags independently.
const [first, second] = LENS_IDS;
const shuffled = { lenses: [{ id: second, label: second }, { id: first, label: first }] };
assert.equal(lensColors(shuffled)[second], LENS_PALETTE[LENS_IDS.indexOf(second)]);
assert.equal(lensColors(shuffled)[first], LENS_PALETTE[LENS_IDS.indexOf(first)]);
assert.deepEqual(
    LENS_IDS.map(id => lensColors({ lenses: [{ id }] })[id]),
    LENS_IDS.map((id, index) => LENS_PALETTE[index]),
    "every lens has its own colour, and no two share one"
);

// More than seven cycles back to the start.
const many = { lenses: Array.from({ length: 9 }, (_, i) => ({ id: `lens${i}`, label: `Lens ${i}` })) };
const colors = lensColors(many);
assert.equal(colors.lens7, LENS_PALETTE[0]);
assert.equal(colors.lens8, LENS_PALETTE[1]);
assert.equal(colorAt(FEATURE_PALETTE, 7), FEATURE_PALETTE[0]);

// Features too.
const features = { features: Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, name: `F${i}` })), nodes: [] };
const constellation = buildConstellation(features, {});
assert.deepEqual(constellation.map(n => n.color), [...FEATURE_PALETTE, FEATURE_PALETTE[0]]);

// No lens or feature name is hardcoded in the renderer. model.js declares
// the shared vocabulary - that is an ordering both views read, not a rule
// about one lens - so its names are allowed inside that declaration only.
const VOCABULARY = /export const LENS_IDS = \[[^\]]*\];/;

for (const file of ["model.js", "main.js", "styles.css"]) {
    const source = fs.readFileSync(path.resolve(HERE, "../webview", file), "utf8").replace(VOCABULARY, "");
    assert.doesNotMatch(source, /--lens-|--c-|--tag-|["']security["']|["']business["']|["']database["']/, `${file} hardcodes a lens or feature name`);
}

console.log("PASS: lens-filter");
