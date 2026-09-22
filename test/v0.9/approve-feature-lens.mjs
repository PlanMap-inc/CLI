import assert from "node:assert/strict";

import { selectNodes } from "../../src/plan/approval.js";

// --------------------------------------------------
// ONE LENS, INSIDE ONE FEATURE
// --------------------------------------------------
// From inside a feature, with a lens on, the button says "Approve
// Security". It could only ever run a plan-wide --lens, so it approved
// security steps in every other feature too - steps the reader had not
// looked at, under a label that said they had.
//
// --feature with --lens is the one pair that means something. Everything
// else is still one selector at a time.
// --------------------------------------------------

const node = (id, feature, lensTags, extra = {}) => ({
    id,
    feature,
    identity: `src/${id}.js::run:function`,
    role: "behaviour",
    title: `Do ${id}`,
    intent: `${id} happens`,
    lensTags,
    rules: [],
    edgesOut: [],
    status: "intended",
    origin: "ai_drafted",
    ...extra
});

const plan = {
    version: 1,
    lenses: [],
    features: [
        { id: "f1", name: "Survey" },
        { id: "f2", name: "Login" }
    ],
    nodes: [
        node("a", "f1", ["security"]),
        node("b", "f1", ["security", "backend"]),
        node("c", "f1", ["backend"]),
        node("d", "f1", ["security"], { role: "vocabulary" }),
        node("e", "f2", ["security"]),
        node("f", "f2", ["backend"])
    ]
};

const ids = selection => selection.matched.map(entry => entry.id);


// --------------------------------------------------
// THE INTERSECTION
// --------------------------------------------------

{
    const selection = selectNodes(plan, { feature: "f1", lens: "security" });

    assert.deepEqual(selection.errors, []);

    assert.deepEqual(
        ids(selection),
        ["a", "b", "d"],
        "this feature's security nodes, and nothing from the other feature"
    );
}

// Every role, not only steps: approving a feature's security means
// approving its terms and preconditions carrying that lens too, and the
// count the button shows has to match what the CLI will do.
assert.ok(
    ids(selectNodes(plan, { feature: "f1", lens: "security" })).includes("d"),
    "a term tagged with the lens is approved with it"
);

// Either half on its own is unchanged.
assert.deepEqual(
    ids(selectNodes(plan, { feature: "f1" })),
    ["a", "b", "c", "d"],
    "--feature alone is what it always was"
);

assert.deepEqual(
    ids(selectNodes(plan, { lens: "security" })),
    ["a", "b", "d", "e"],
    "--lens alone is still plan-wide"
);

// An empty intersection is an empty result, not an error.
{
    const selection = selectNodes(plan, { feature: "f2", lens: "database" });

    assert.deepEqual(selection.errors, []);
    assert.deepEqual(ids(selection), []);
}


// --------------------------------------------------
// EVERY OTHER COMBINATION STILL FAILS
// --------------------------------------------------

for (const [what, options] of [
    ["identity with feature", { identity: "src/a.js::run:function", feature: "f1" }],
    ["identity with lens", { identity: "src/a.js::run:function", lens: "security" }],
    ["all with feature", { all: true, feature: "f1" }],
    ["all with lens", { all: true, lens: "security" }],
    ["all with identity", { all: true, identity: "src/a.js::run:function" }],
    ["all three", { feature: "f1", lens: "security", all: true }],
    ["feature, lens and an identity", {
        feature: "f1",
        lens: "security",
        identity: "src/a.js::run:function"
    }]
]) {
    const selection = selectNodes(plan, options);

    assert.deepEqual(ids(selection), [], `${what} must match nothing`);
    assert.equal(selection.errors.length, 1, `${what} must be refused`);
    assert.match(selection.errors[0], /Use only one target selector/, what);
}

// And no selector at all is still no selector at all.
assert.match(
    selectNodes(plan, {}).errors[0],
    /A target, --all, --lens, or --feature is required\./
);

console.log("PASS: approve-feature-lens");
