import assert from "node:assert/strict";

import { buildCallGraph } from "../../src/baseline/callgraph.js";
import { linkFeatureSteps } from "../../src/plan/draft.js";

// --------------------------------------------------
// NO GENUINE CROSS-FEATURE CALLS - NONE SHOULD BE DRAWN
// --------------------------------------------------
// Shaped on the real AI_Coding_Survey project: Login's authController calls
// its own authService, Survey's controller calls its own service, and
// nothing in either feature calls into the other. The honest Constellation
// has no arrow between Login and Survey at all.
// --------------------------------------------------

const declarations = [
    { identity: "auth.controller.js::startAuth:function", file: "auth.controller.js",
      properties: { calls: ["startAuthService", "res.status"] } },
    { identity: "auth.service.js::startAuthService:function", file: "auth.service.js",
      properties: { calls: ["client.verifyIdToken", "jwt.sign"] } },
    { identity: "survey.controller.js::submitSurvey:function", file: "survey.controller.js",
      properties: { calls: ["submitSurveyService", "res.status"] } },
    { identity: "survey.service.js::submitSurveyService:function", file: "survey.service.js",
      properties: { calls: ["pool.connect"] } },
    { identity: "server.js::startServer:function", file: "server.js",
      properties: { calls: ["pool.query", "app.listen"] } },
    { identity: "health.controller.js::healthCheck:function", file: "health.controller.js",
      properties: { calls: ["res.status"] } }
];

const graph = buildCallGraph(declarations);

const nodes = [
    { id: "plan_0001", feature: "login", identity: "auth.controller.js::startAuth:function", step: 1, edgesOut: [] },
    { id: "plan_0002", feature: "login", identity: "auth.service.js::startAuthService:function", step: 2, edgesOut: [] },
    { id: "plan_0003", feature: "survey", identity: "survey.controller.js::submitSurvey:function", step: 1, edgesOut: [] },
    { id: "plan_0004", feature: "survey", identity: "survey.service.js::submitSurveyService:function", step: 2, edgesOut: [] },
    { id: "plan_0005", feature: "server", identity: "server.js::startServer:function", step: 1, edgesOut: [] },
    { id: "plan_0006", feature: "server", identity: "health.controller.js::healthCheck:function", step: 2, edgesOut: [] }
];

linkFeatureSteps(nodes, graph);

const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

assert.deepEqual(byId.plan_0001.edgesOut, ["plan_0002"], "the controller really does call the service, in the same feature");
assert.deepEqual(byId.plan_0003.edgesOut, ["plan_0004"], "the survey controller calls the survey service, in the same feature");
assert.deepEqual(byId.plan_0005.edgesOut, [], "startServer calls only external libraries - nothing in this plan");
assert.deepEqual(byId.plan_0002.edgesOut, [], "auth.service calls only external libraries - jwt.sign, google-auth-library");
assert.deepEqual(byId.plan_0006.edgesOut, [], "healthCheck calls only res.status - not a project declaration");

for (const node of nodes) {
    for (const target of node.edgesOut) {
        assert.equal(byId[target].feature, node.feature,
            "no fabricated cross-feature edge appears anywhere in this fixture, because none of the real calls cross a feature boundary");
    }
}

// --------------------------------------------------
// A GENUINE CROSS-FEATURE CALL IS DRAWN, SCOPED PER-FEATURE MISSES IT
// --------------------------------------------------
// The one case widening linkFeatureSteps exists for: a declaration in one
// feature really does call a declaration that belongs to a node in another
// feature. The old, per-feature-scoped version could never find this,
// because its identity->node map only ever held the current feature's own
// members.
// --------------------------------------------------

const crossDeclarations = [
    { identity: "checkout.js::finish:function", file: "checkout.js", properties: { calls: ["sendReceipt"] } },
    { identity: "notifications.js::sendReceipt:function", file: "notifications.js", properties: { calls: [] } }
];

const crossGraph = buildCallGraph(crossDeclarations);

const crossNodes = [
    { id: "plan_0010", feature: "checkout", identity: "checkout.js::finish:function", step: 1, edgesOut: [] },
    { id: "plan_0011", feature: "notifications", identity: "notifications.js::sendReceipt:function", step: 1, edgesOut: [] }
];

linkFeatureSteps(crossNodes, crossGraph);

assert.deepEqual(
    crossNodes[0].edgesOut,
    ["plan_0011"],
    "finish() really does call sendReceipt(), which lives in a different feature - that is a real relationship and must be drawn"
);

console.log("PASS: cross-feature-links");
