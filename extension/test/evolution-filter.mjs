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

// Tags present, in the shared vocabulary's order rather than the order the
// scan happened to write them, so a lens is the same colour in both views.
assert.deepEqual(evolutionTags(evolution), ["frontend", "backend", "security"]);
assert.deepEqual(
    tagColors(evolutionTags(evolution)),
    { frontend: LENS_PALETTE[0], backend: LENS_PALETTE[1], security: LENS_PALETTE[2] }
);

// A tag outside the vocabulary is coloured by its own position.
assert.deepEqual(tagColors(["models", "views", "tasks"]), { models: LENS_PALETTE[0], views: LENS_PALETTE[1], tasks: LENS_PALETTE[2] });
const many = tagColors(Array.from({ length: 8 }, (_, i) => `t${i}`));
assert.equal(many.t7, LENS_PALETTE[0], "colours cycle after seven");

// Collapse: headings open, a declaration's own history closed.
const feature = { id: "f", feature: true, children: [{ id: "y", children: [] }] };
const group = { id: "g", group: true, children: [{ id: "y", children: [] }] };
const branch = { id: "x", children: [{ id: "y", children: [] }] };
const leaf = { id: "z", children: [] };
assert.equal(isCollapsed(feature, 0), false, "a feature opens");
assert.equal(isCollapsed(group, 1), false, "a group opens");
assert.equal(isCollapsed(branch, 2), true, "a declaration's changes start closed");
assert.equal(isCollapsed(leaf, 5), false, "a leaf has nothing to collapse");
assert.equal(isCollapsed(branch, 2, { filtered: true }), false, "a tag filter opens what it kept");
assert.equal(isCollapsed(branch, 2, { toggled: new Map([["x", false]]) }), false, "the user's toggle wins");
assert.equal(isCollapsed(feature, 0, { toggled: new Map([["f", true]]) }), true);


// --------------------------------------------------
// GROUPS
// --------------------------------------------------
// The level between a feature and its declarations, so a big feature reads
// as a few jobs. A declaration with no group hangs from the feature itself.

const grouped = buildEvolutionTree({
    nodes: [
        { id: "j", parent: null, feature: "Login", group: "Authentication", tags: ["security"] },
        { id: "k", parent: null, feature: "Login", group: "Authentication", tags: ["backend"] },
        { id: "k1", parent: "k", feature: "Login", group: "Authentication", tags: [] },
        { id: "m", parent: null, feature: "Login", group: "Google sign-in", tags: ["frontend"] },
        { id: "n", parent: null, feature: "Login", tags: ["platform"] }
    ]
});

assert.deepEqual(
    grouped.map(item => [item.title, item.children.map(child => [child.title ?? child.id, child.group === true])]),
    [["Login", [["Authentication", true], ["Google sign-in", true], ["n", false]]]]
);

assert.equal(countNodes(grouped), 5, "groups are headings, not entries");

// A change still nests under the declaration it changed, inside the group.
assert.deepEqual(shape(grouped)[0][1][0][1], [["j", []], ["k", [["k1", []]]]]);

// One group in a feature adds a level and says nothing, so it is dropped.
const single = buildEvolutionTree({
    nodes: [
        { id: "p", parent: null, feature: "Health", group: "Checks", tags: [] },
        { id: "q", parent: null, feature: "Health", group: "Checks", tags: [] }
    ]
});
assert.deepEqual(shape(single), [["feature:Health", [["p", []], ["q", []]]]]);

// A graph written before groups existed reads exactly as it did.
assert.deepEqual(shape(buildEvolutionTree(evolution)), shape(tree));

console.log("PASS: evolution-filter");
