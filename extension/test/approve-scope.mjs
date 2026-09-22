import assert from "node:assert/strict";
import fs from "node:fs";

import { approveScope } from "../webview/model.js";
import { buildCliArgs } from "../out/messages.js";

// --------------------------------------------------
// THE BUTTON SAYS WHAT THE CLICK DOES
// --------------------------------------------------
// Inside a feature with a lens on it read "Approve Security" and ran a
// plan-wide --lens, so it approved security steps in every other feature
// too - steps the reader had never opened, under a label that said they
// had.
//
// The count is intended NODES, every role, because that is what the CLI
// call will approve. A button that counts steps and approves terms as well
// is the same lie one size smaller.
// --------------------------------------------------

const node = (id, feature, role, lensTags, status = "intended") => ({
    id, feature, role, lensTags, status,
    identity: `src/${id}.js::run:function`,
    title: `Step ${id}`, intent: "x", rules: [], edgesOut: []
});

const plan = {
    version: 1,
    lenses: [{ id: "security", label: "Security" }, { id: "backend", label: "Backend" }],
    features: [{ id: "f", name: "Survey" }, { id: "g", name: "Login" }],
    nodes: [
        node("a", "f", "behaviour", ["security"]),
        node("b", "f", "behaviour", ["security", "backend"]),
        node("c", "f", "behaviour", ["backend"]),
        node("d", "f", "vocabulary", ["security"]),
        node("e", "f", "machinery", ["security"]),
        node("h", "f", "behaviour", ["security"], "approved"),
        node("i", "g", "behaviour", ["security"]),
        node("j", "g", "behaviour", [])
    ]
};

const root = "/work/project";


// --------------------------------------------------
// THE CONSTELLATION: THE WHOLE PLAN
// --------------------------------------------------

const whole = approveScope(plan, {});

assert.equal(whole.scope, "plan");
assert.equal(whole.count, 7, "every intended node, whatever its role");
assert.equal(whole.label, "Approve plan (7)");
assert.deepEqual(whole.breakdown, ["5 steps", "1 term", "1 precondition"]);
assert.deepEqual(whole.message, { type: "approveAll" });
assert.deepEqual(buildCliArgs(whole.message, root), ["approve", root, "--all"]);


// --------------------------------------------------
// INSIDE A FEATURE, NO LENS
// --------------------------------------------------

const feature = approveScope(plan, { featureId: "f" });

assert.equal(feature.scope, "feature");
assert.equal(feature.count, 5, "this feature's intended nodes, and the approved one is not one");
assert.equal(feature.label, "Approve Survey (5)");
assert.deepEqual(feature.breakdown, ["3 steps", "1 term", "1 precondition"]);
assert.deepEqual(feature.message, { type: "approveFeature", featureId: "f" });

assert.deepEqual(
    buildCliArgs(feature.message, root),
    ["approve", root, "--feature", "f"]
);


// --------------------------------------------------
// INSIDE A FEATURE, WITH A LENS
// --------------------------------------------------
// Scoped to this feature. Login's security step is not in the count and
// not in the call.

const scoped = approveScope(plan, { featureId: "f", lensId: "security" });

assert.equal(scoped.scope, "feature-lens");
assert.equal(scoped.count, 4, "a, b, d and e - not h, which is approved, and not Login's i");
assert.equal(scoped.label, "Approve Security (4)");
assert.deepEqual(scoped.breakdown, ["2 steps", "1 term", "1 precondition"]);
assert.deepEqual(scoped.message, { type: "approveLens", lensId: "security", featureId: "f" });

assert.deepEqual(
    buildCliArgs(scoped.message, root),
    ["approve", root, "--feature", "f", "--lens", "security"],
    "the CLI is given the same scope the label claims"
);

// The plan-wide lens call still exists, for anything that needs it.
assert.deepEqual(
    buildCliArgs({ type: "approveLens", lensId: "security" }, root),
    ["approve", root, "--lens", "security"]
);


// --------------------------------------------------
// NOTHING LEFT TO APPROVE
// --------------------------------------------------

const done = approveScope(
    { ...plan, nodes: plan.nodes.map(entry => ({ ...entry, status: "approved" })) },
    { featureId: "f" }
);

assert.equal(done.count, 0);
assert.equal(done.label, "Approve Survey (0)");
assert.deepEqual(done.breakdown, []);

assert.equal(approveScope({ nodes: [], features: [] }, {}).count, 0);
assert.equal(approveScope(null, {}).count, 0);

// A lens no node in this feature carries.
assert.equal(approveScope(plan, { featureId: "g", lensId: "backend" }).count, 0);


// --------------------------------------------------
// THE HOST ASKS THE SAME QUESTION
// --------------------------------------------------
// The confirm dialog used to count a lens across the whole plan while the
// button said the feature's name.

const host = fs.readFileSync(new URL("../src/extension.ts", import.meta.url), "utf8");

assert.match(host, /message\.type !== "approveFeature"/, "a feature approve is confirmed too");
assert.match(host, /!featureId \|\| node\.feature === featureId/, "and the dialog counts the same scope");
assert.match(host, /!lensId \|\| \(Array\.isArray\(node\.lensTags\)/);
assert.match(host, /\["machinery", "precondition", "preconditions"\]/, "with the same breakdown");

console.log("PASS: approve-scope");
