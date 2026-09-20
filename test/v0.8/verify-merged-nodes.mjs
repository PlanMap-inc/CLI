import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { verifyPlan } from "../../src/verification/engine.js";

// --------------------------------------------------
// A MERGED STEP IS STILL CHECKED DECLARATION BY DECLARATION
// --------------------------------------------------
// One step may stand for several declarations. The whole safety of that
// rests on verify continuing to check each of them: if only the first were
// checked, merging would be a way to stop looking at code, and a change to
// the second would pass silently.
//
// Two things measured on a real project before this was fixed:
//   - verify rejected every rule on a merged node, because the target check
//     predates merging and compared against the node's one identity
//   - once that was lifted, every rule was evaluated against the FIRST
//     declaration's facts, so the second was never really checked
// --------------------------------------------------

const ONE_RETURN = "function {name}(x) {\n    return { items: x };\n}\n";
const TWO_RETURNS = "function {name}(x) {\n    if (!x) {\n        return { items: [] };\n    }\n    return { items: x };\n}\n";

const identities = ["api.js::getConstituencies:function", "api.js::getDistricts:function"];

function project({ constituencies = ONE_RETURN, districts = ONE_RETURN, nodes }) {
    const root = mkdtempSync(path.join(tmpdir(), "planmap-merged-"));
    mkdirSync(path.join(root, ".planmap"));

    writeFileSync(
        path.join(root, "api.js"),
        constituencies.replace("{name}", "getConstituencies") + "\n" + districts.replace("{name}", "getDistricts")
    );

    writeFileSync(path.join(root, ".planmap", "plan.json"), JSON.stringify({
        version: 1, lenses: [], features: [{ id: "f", name: "Lookups" }], nodes
    }));
    writeFileSync(path.join(root, ".planmap", "baseline.json"), JSON.stringify({ version: 1, declarations: [] }));

    return root;
}

const mergedNode = {
    id: "plan_0001",
    feature: "f",
    identity: identities[0],
    identities,
    dimensions: ["constituency", "district"],
    role: "behaviour",
    title: "Return available constituencies or districts",
    intent: "A list returns when the query can be run",
    status: "approved",
    approvedBy: "tester",
    lensTags: ["backend"],
    // The same assert, once per declaration - which is what the merge gate
    // proved before allowing the merge.
    rules: identities.map(target => ({
        kind: "behaviour",
        target,
        assert: { returns: { op: "==", value: 1 } }
    }))
};

const statusOf = options =>
    verifyPlan(project({ ...options, nodes: [mergedNode] }), {}).results[0];

// Both declarations satisfy the claim.
const clean = statusOf({});
assert.deepEqual(clean.errors, [], `unexpected errors: ${JSON.stringify(clean.errors)}`);
assert.equal(clean.status, "implemented", "a rule targeting a merged declaration is not an error");

// The SECOND one drifts. It has no node of its own, and it is still caught.
const second = statusOf({ districts: TWO_RETURNS });
assert.equal(
    second.status,
    "drifted",
    "a change to a declaration with no node of its own must still be caught - otherwise merging hides code"
);
assert.ok(second.violations.length > 0);

// And the first, so neither declaration is privileged.
assert.equal(statusOf({ constituencies: TWO_RETURNS }).status, "drifted");

// --------------------------------------------------
// AN ORDINARY NODE IS UNCHANGED
// --------------------------------------------------

const single = { ...mergedNode, identities: undefined, dimensions: undefined, rules: [mergedNode.rules[0]] };

assert.equal(verifyPlan(project({ nodes: [single] }), {}).results[0].status, "implemented");
assert.equal(
    verifyPlan(project({ constituencies: TWO_RETURNS, nodes: [single] }), {}).results[0].status,
    "drifted"
);

// --------------------------------------------------
// A RULE THE NODE NEVER CLAIMED IS STILL REJECTED
// --------------------------------------------------
// Lifting the target check to "any of the node's identities" must not lift
// it to "anything at all".

const stray = {
    ...mergedNode,
    rules: [{ kind: "behaviour", target: "other.js::unrelated:function", assert: { returns: { op: "==", value: 1 } } }]
};

const strayResult = verifyPlan(project({ nodes: [stray] }), {}).results[0];
assert.equal(strayResult.status, "error");
assert.match(strayResult.errors.map(error => error.message).join(" "), /does not match node identity/);

console.log("PASS: verify-merged-nodes");
