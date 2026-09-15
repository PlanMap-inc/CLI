import assert from "node:assert/strict";

import { effectiveStatus, featureStatus } from "../webview/model.js";

const node = (id, status, extra = {}) => ({ id, status, identity: `src/${id}.js::${id}:function`, ...extra });

// Worst status wins: one drifted node among implemented ones makes the feature drifted.
const verified = {
    "src/a.js::a:function": { status: "implemented", verifiedAgainst: "a@1" },
    "src/b.js::b:function": { status: "implemented", verifiedAgainst: "b@1" },
    "src/c.js::c:function": { status: "drifted", verifiedAgainst: "c@1" }
};
assert.equal(featureStatus([node("a", "approved"), node("b", "approved"), node("c", "approved")], verified), "drifted");

// error outranks intended; intended outranks approved; approved outranks implemented.
assert.equal(featureStatus([node("x", "intended"), node("y", "error")], {}), "error");
assert.equal(featureStatus([node("x", "intended"), node("y", "approved")], {}), "intended");
assert.equal(featureStatus([node("x", "approved"), node("y", "implemented")], {}), "approved");

// superseded is historical and never decides the feature's status.
assert.equal(featureStatus([node("x", "superseded"), node("y", "implemented")], {}), "implemented");

// An empty feature has nothing built yet.
assert.equal(featureStatus([], {}), "intended");

// The saved verify result overrides plan.json's status - but only for the exact node version it checked.
assert.equal(effectiveStatus(node("c", "approved"), verified), "drifted");
assert.equal(
    effectiveStatus(node("c", "approved", { id: "c_revised", version: 2 }), verified),
    "approved",
    "a drift recorded against an older version does not apply after a revise"
);
assert.equal(
    effectiveStatus(node("c", "approved", { version: 2 }), { "src/c.js::c:function": { status: "drifted", verifiedAgainst: "c@2" } }),
    "drifted"
);

// Nodes with no identity, or an unknown status, fall back safely.
assert.equal(effectiveStatus({ id: "g", status: "approved" }, verified), "approved");
assert.equal(effectiveStatus({ id: "g", status: "bogus" }, {}), "intended");

console.log("PASS: feature-status");
