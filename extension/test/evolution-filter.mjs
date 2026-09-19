import assert from "node:assert/strict";

import {
    buildEvolutionTree,
    countNodes,
    evolutionTags,
    isCollapsed,
    pruneByTag,
    tagColors
} from "../webview/evolution.js";
import { LENS_IDS, LENS_PALETTE } from "../webview/model.js";

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
// Each takes the colour of its place in the vocabulary, not of its place in
// this project's tag list.
const atVocabulary = id => LENS_PALETTE[LENS_IDS.indexOf(id)];
assert.deepEqual(
    tagColors(evolutionTags(evolution)),
    { frontend: atVocabulary("frontend"), backend: atVocabulary("backend"), security: atVocabulary("security") }
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
// HEADINGS, AT WHATEVER DEPTH
// --------------------------------------------------
// A declaration carries a path of headings between it and its feature. The
// outline nests as deep as that path goes - nothing caps it - and folds
// away any heading that does not actually group.

const grouped = buildEvolutionTree({
    nodes: [
        { id: "j", parent: null, feature: "Login", path: ["Sign in", "Google"], tags: ["security"] },
        { id: "k", parent: null, feature: "Login", path: ["Sign in", "Google"], tags: ["backend"] },
        { id: "k1", parent: "k", feature: "Login", path: ["Sign in", "Google"], tags: [] },
        { id: "m", parent: null, feature: "Login", path: ["Sign in", "Email"], tags: ["frontend"] },
        { id: "n", parent: null, feature: "Login", path: ["Sign in", "Email"], tags: ["frontend"] },
        { id: "o", parent: null, feature: "Login", path: ["Tokens"], tags: ["security"] },
        { id: "p", parent: null, feature: "Login", path: ["Tokens"], tags: ["security"] },
        { id: "q", parent: null, feature: "Login", tags: ["backend"] }
    ]
});

assert.deepEqual(shape(grouped), [
    ["feature:Login", [
        ["group:Login > Sign in", [
            ["group:Login > Sign in > Google", [["j", []], ["k", [["k1", []]]]]],
            ["group:Login > Sign in > Email", [["m", []], ["n", []]]]
        ]],
        ["group:Login > Tokens", [["o", []], ["p", []]]],
        ["q", []]
    ]]
], "headings nest as deep as the path, and an unheaded declaration sits at the top");

assert.equal(countNodes(grouped), 8, "headings are not entries, however deep");

// Depth is not capped. Four headings nest as four headings, as long as each
// one actually branches - a sibling at every level keeps them all standing.
const deep = buildEvolutionTree({
    nodes: [
        { id: "d1", parent: null, feature: "F", path: ["a", "b", "c", "d"], tags: [] },
        { id: "d2", parent: null, feature: "F", path: ["a", "b", "c", "d"], tags: [] },
        { id: "s1", parent: null, feature: "F", path: ["a", "b", "c", "other"], tags: [] },
        { id: "s2", parent: null, feature: "F", path: ["a", "b", "other"], tags: [] },
        { id: "s3", parent: null, feature: "F", path: ["a", "other"], tags: [] },
        { id: "s4", parent: null, feature: "F", path: ["other"], tags: [] }
    ]
});
const depthOf = item => (item.children.length ? 1 + Math.max(...item.children.map(depthOf)) : 1);
assert.equal(depthOf(deep[0]), 6, "feature + four headings + the declaration");

// A heading with one child restates that child, so it is folded away -
// however long the chain of them is. This is the only thing that limits
// depth, and it is about information, not a number.
const folded = buildEvolutionTree({
    nodes: [
        { id: "s", parent: null, feature: "Login", path: ["Sign in", "Google", "Deeply", "Nested"], tags: [] },
        { id: "t", parent: null, feature: "Login", path: ["Tokens"], tags: [] },
        { id: "u", parent: null, feature: "Login", path: ["Tokens"], tags: [] }
    ]
});
assert.deepEqual(shape(folded), [
    ["feature:Login", [["s", []], ["group:Login > Tokens", [["t", []], ["u", []]]]]]
], "a chain of single-child headings collapses to the declaration itself");

// A heading that really does group is kept, even as the only one.
const sole = buildEvolutionTree({
    nodes: [
        { id: "v", parent: null, feature: "Health", path: ["Checks"], tags: [] },
        { id: "w", parent: null, feature: "Health", path: ["Checks"], tags: [] }
    ]
});
assert.deepEqual(shape(sole), [["feature:Health", [["group:Health > Checks", [["v", []], ["w", []]]]]]]);

// The single "group" string PlanMap wrote first still reads, and nests
// exactly where the same name in a path would.
assert.deepEqual(
    shape(buildEvolutionTree({
        nodes: [
            { id: "v", parent: null, feature: "Health", group: "Checks", tags: [] },
            { id: "w", parent: null, feature: "Health", group: "Checks", tags: [] }
        ]
    })),
    shape(sole),
    "a graph written before paths existed nests the same way"
);

// A graph with no headings at all reads exactly as it did.
assert.deepEqual(shape(buildEvolutionTree(evolution)), shape(tree));

console.log("PASS: evolution-filter");
