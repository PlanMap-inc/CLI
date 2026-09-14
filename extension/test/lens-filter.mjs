import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    FEATURE_PALETTE,
    LENS_PALETTE,
    buildConstellation,
    colorAt,
    fadedIds,
    lensColors
} from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Filtering on lensTags: non-matching nodes are faded, never removed.
const nodes = [
    { id: "n1", lensTags: ["security", "backend"] },
    { id: "n2", lensTags: ["backend"] },
    { id: "n3", lensTags: [] },
    { id: "n4" }
];

assert.deepEqual([...fadedIds(nodes, "security")].sort(), ["n2", "n3", "n4"]);
assert.deepEqual([...fadedIds(nodes, "backend")].sort(), ["n3", "n4"]);
assert.equal(fadedIds(nodes, null).size, 0, "no active lens fades nothing");
assert.equal(nodes.length, 4, "filtering does not remove nodes");

// Lens colours come from position, not from the lens name.
const django = { lenses: [{ id: "models", label: "Models" }, { id: "views", label: "Views" }, { id: "tasks", label: "Tasks" }] };
assert.deepEqual(lensColors(django), { models: LENS_PALETTE[0], views: LENS_PALETTE[1], tasks: LENS_PALETTE[2] });

const renamed = { lenses: [{ id: "security", label: "Security" }, { id: "models", label: "Models" }] };
assert.equal(lensColors(renamed).security, LENS_PALETTE[0], "a lens named security gets no special colour");

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

// No lens or feature name is hardcoded in the renderer.
for (const file of ["model.js", "main.js", "styles.css"]) {
    const source = fs.readFileSync(path.resolve(HERE, "../webview", file), "utf8");
    assert.doesNotMatch(source, /--lens-|--c-|--tag-|["']security["']|["']business["']|["']database["']/, `${file} hardcodes a lens or feature name`);
}

console.log("PASS: lens-filter");
