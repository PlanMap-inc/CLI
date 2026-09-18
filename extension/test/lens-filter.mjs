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
const ids = lensId => buildFeatureGraph(plan, "f", {}, lensId).nodes.map(n => n.id).sort();

assert.deepEqual(ids("security"), ["n1"]);
assert.deepEqual(ids("backend"), ["n1", "n2"]);
assert.deepEqual(ids(null), ["n1", "n2", "n3", "n4"], "no active lens shows everything");
assert.deepEqual(buildFeatureGraph(plan, "f", {}, "security").edges, [], "edges to hidden nodes are dropped");
assert.deepEqual(buildFeatureGraph(plan, "f", {}, "backend").edges, [{ from: "n1", to: "n2" }]);

const backendYs = buildFeatureGraph(plan, "f", {}, "backend").nodes.map(n => n.y).sort((a, b) => a - b);
// Rows snap to the grid, so the step is ~150px; a hidden row in between would double it.
assert.ok(backendYs[1] - backendYs[0] < 200, "hidden nodes leave no gap in the column");

// A lens outside PlanMap's vocabulary is coloured by its position.
const django = { lenses: [{ id: "models", label: "Models" }, { id: "views", label: "Views" }, { id: "tasks", label: "Tasks" }] };
assert.deepEqual(lensColors(django), { models: LENS_PALETTE[0], views: LENS_PALETTE[1], tasks: LENS_PALETTE[2] });

// One in the vocabulary is coloured by its place there instead, wherever the
// plan happens to list it: the same perspective must be the same colour in
// the Plan Graph and in Project Evolution, which orders tags independently.
const shuffled = { lenses: [{ id: "security", label: "Security" }, { id: "frontend", label: "Frontend" }] };
assert.equal(lensColors(shuffled).security, LENS_PALETTE[LENS_IDS.indexOf("security")]);
assert.equal(lensColors(shuffled).frontend, LENS_PALETTE[LENS_IDS.indexOf("frontend")]);
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
