import assert from "node:assert/strict";

import {
    buildEvolutionTree,
    countNodes,
    evolutionTags,
    isCollapsed,
    pruneByTag,
    tagColors
} from "../webview/evolution.js";
import { LENS_PALETTE } from "../webview/model.js";

const shape = items => items.map(item => [item.feature ? `feature:${item.title}` : item.id, shape(item.children)]);

const evolution = {
    nodes: [
        { id: "a", parent: null, feature: "Auth", tags: ["backend"] },
        { id: "b", parent: null, feature: "Auth", tags: [] },
        { id: "c", parent: null, feature: "Orders", tags: ["security"] },
        { id: "d", parent: null, feature: "Misc", tags: ["frontend"] },
        { id: "a1", parent: "a", feature: "Auth", tags: ["security"] },
        { id: "a2", parent: "a", feature: "Auth", tags: [] },
        { id: "b1", parent: "b", feature: "Auth", tags: [] },
        { id: "c1", parent: "c", feature: "Orders", tags: "not a list" }
    ]
};

const tree = buildEvolutionTree(evolution);

// Filtering prunes to matching branches and keeps every ancestor of a match:
// "a" is not tagged security but stays, because its change "a1" is.
assert.deepEqual(shape(pruneByTag(tree, "security")), [
    ["feature:Auth", [["a", [["a1", []]]]]],
    ["feature:Orders", [["c", []]]]
]);

assert.deepEqual(shape(pruneByTag(tree, "frontend")), [["feature:Misc", [["d", []]]]]);
assert.deepEqual(pruneByTag(tree, "nothing-has-this"), []);
assert.equal(pruneByTag(tree, null), tree, "no tag means no filtering");
assert.equal(countNodes(pruneByTag(tree, "security")), 3);
assert.equal(countNodes(tree), 8, "pruning never mutates the full tree");

// Tags come from the data, in first-seen order; colours by index, never by name.
assert.deepEqual(evolutionTags(evolution), ["backend", "security", "frontend"]);
assert.deepEqual(tagColors(["models", "views", "tasks"]), { models: LENS_PALETTE[0], views: LENS_PALETTE[1], tasks: LENS_PALETTE[2] });
const many = tagColors(Array.from({ length: 8 }, (_, i) => `t${i}`));
assert.equal(many.t7, LENS_PALETTE[0], "colours cycle after seven");

// Collapse: branches deeper than level 2 start closed.
const branch = { id: "x", children: [{ id: "y", children: [] }] };
const leaf = { id: "z", children: [] };
assert.equal(isCollapsed(branch, 0), false);
assert.equal(isCollapsed(branch, 1), false);
assert.equal(isCollapsed(branch, 2), true);
assert.equal(isCollapsed(branch, 3), true);
assert.equal(isCollapsed(leaf, 5), false, "a leaf has nothing to collapse");
assert.equal(isCollapsed(branch, 2, { filtered: true }), false, "a tag filter opens what it kept");
assert.equal(isCollapsed(branch, 2, { toggled: new Map([["x", false]]) }), false, "the user's toggle wins");
assert.equal(isCollapsed(branch, 0, { toggled: new Map([["x", true]]) }), true);

console.log("PASS: evolution-filter");
