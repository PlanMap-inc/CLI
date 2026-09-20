import assert from "node:assert/strict";

import {
    ROLE_IDS,
    DEFAULT_ROLE,
    canonicalRole,
    proposeRole,
    roleCatalogue
} from "../../src/llm/roles.js";

import { buildCallGraph } from "../../src/baseline/callgraph.js";
import { normalizeBrownfieldNodes, linkFeatureSteps } from "../../src/plan/draft.js";
import { validatePlan } from "../../src/plan/model.js";

// --------------------------------------------------
// THE ROLE VOCABULARY
// --------------------------------------------------

assert.deepEqual(ROLE_IDS, ["behaviour", "vocabulary", "machinery", "tool"]);
assert.equal(DEFAULT_ROLE, "behaviour", "an unlabelled node is a step, as it was before roles existed");

assert.equal(canonicalRole("Setup"), "machinery");
assert.equal(canonicalRole("HELPER"), "tool");
assert.equal(canonicalRole("constants"), "vocabulary");
assert.equal(canonicalRole("step"), "behaviour");
assert.equal(canonicalRole("banana"), null, "an unknown word is refused, never guessed into a fifth role");
assert.equal(canonicalRole(null), null);

for (const id of ROLE_IDS) assert.match(roleCatalogue(), new RegExp(`^${id}$`, "m"));

// --------------------------------------------------
// PROPOSING A ROLE FROM FACTS
// --------------------------------------------------

// A named list holds no behaviour by construction.
assert.equal(proposeRole({ kind: "data", identity: "a.js::SCOPES:data" }, 0, 0), "vocabulary");

// Plumbing nothing in the project calls.
assert.equal(
    proposeRole({ kind: "function", identity: "s.js::connectPool:function", properties: { params: 0 } }, 0, 0),
    "machinery"
);

// An entry point nothing calls is NOT machinery - it is reached over HTTP.
assert.equal(
    proposeRole({ kind: "function", identity: "api.py::get_agencies:function", properties: { params: 4 } }, 0, 0),
    "behaviour",
    "a declaration with no caller is only machinery when it also reads as plumbing"
);

// Small, shared, and calls nothing of the project's own.
assert.equal(
    proposeRole({ kind: "function", identity: "u.js::slug:function", properties: { params: 1, throws: 0, awaits: 0 } }, 4, 0),
    "tool"
);

// The clause that stops a domain method being called a helper: it reaches
// into the project's own code, so it is deciding something.
assert.equal(
    proposeRole({ kind: "function", identity: "s.py::risk_for_scope:function", properties: { params: 2, throws: 0, awaits: 0 } }, 4, 3),
    "behaviour",
    "a declaration that calls the project's own code is orchestrating, not helping"
);

// --------------------------------------------------
// THE CALL GRAPH
// --------------------------------------------------

const declarations = [
    { identity: "a.js::handler:function", file: "a.js", kind: "function", properties: { calls: ["clean", "store.save"] } },
    { identity: "u.js::clean:function", file: "u.js", kind: "function", properties: { calls: [] } },
    { identity: "d.js::store.save:method", file: "d.js", kind: "method", properties: { calls: [] } },
    { identity: "a.js::orphan:function", file: "a.js", kind: "function", properties: { calls: ["lodash.merge"] } }
];

const graph = buildCallGraph(declarations);

assert.deepEqual([...graph.callees.get("a.js::handler:function")].sort(), [
    "d.js::store.save:method",
    "u.js::clean:function"
]);
assert.equal(graph.callerCount.get("u.js::clean:function"), 1);
assert.equal(graph.callerCount.get("a.js::orphan:function"), 0);
assert.equal(
    graph.callees.get("a.js::orphan:function").size,
    0,
    "a call that lands outside the project is not an edge"
);

// Ambiguity is dropped rather than guessed.
const ambiguous = buildCallGraph([
    { identity: "one.js::post:function", file: "one.js", properties: { calls: [] } },
    { identity: "two.js::post:function", file: "two.js", properties: { calls: [] } },
    { identity: "three.js::caller:function", file: "three.js", properties: { calls: ["post"] } }
]);
assert.equal(
    ambiguous.callees.get("three.js::caller:function").size,
    0,
    "a name matching two declarations draws no edge - a missing edge is less specific, a wrong one is untrue"
);

// Same-file wins where it is the only local match.
const sameFile = buildCallGraph([
    { identity: "one.js::post:function", file: "one.js", properties: { calls: [] } },
    { identity: "two.js::post:function", file: "two.js", properties: { calls: [] } },
    { identity: "one.js::caller:function", file: "one.js", properties: { calls: ["post"] } }
]);
assert.deepEqual([...sameFile.callees.get("one.js::caller:function")], ["one.js::post:function"]);

// --------------------------------------------------
// THE MERGE GATE
// --------------------------------------------------

const plan = {
    version: 1,
    lenses: [],
    features: [{ id: "feat_0001", name: "Lookups" }],
    nodes: []
};

const candidates = [
    { identity: "api.py::get_agencies:function", type: "added" },
    { identity: "api.py::get_mps:function", type: "added" },
    { identity: "api.py::get_states:function", type: "added" }
];

// The shape getEvolutionFacts really returns: the fact fields live under
// "properties", not at the top. A gate reading the wrapper finds no field
// present, so every clause errors and every merge is refused - which is
// exactly what happened on a real project until this was fixed.
const shared = { file: "api.py", kind: "function", properties: { calls: ["get_store"], throws: 0, returns: 1, params: 2 } };
const facts = {
    "api.py::get_agencies:function": shared,
    "api.py::get_mps:function": shared,
    "api.py::get_states:function": shared
};

const merging = {
    nodes: [{
        identities: candidates.map(c => c.identity),
        role: "behaviour",
        feature: "Lookups",
        step: 1,
        title: "Look up the risk score for any scope",
        intent: "Every scope answers from the same store",
        dimensions: ["agency", "MP", "state"],
        lensTags: ["backend"],
        readings: {},
        rules: [{ kind: "behaviour", target: "api.py::get_agencies:function", assert: { calls: { op: "contains", value: "get_store" } } }]
    }]
};

const dropped = [];
const merged = normalizeBrownfieldNodes(merging, plan, candidates, dropped, [], {}, {}, facts, {});

assert.equal(merged.length, 1, "one assert true of all three declarations merges them into one step");
assert.deepEqual(merged[0].identities, candidates.map(c => c.identity));
assert.equal(merged[0].identity, "api.py::get_agencies:function", "the first declaration stays the node's own");
assert.deepEqual(merged[0].dimensions, ["agency", "MP", "state"]);
assert.equal(merged[0].role, "behaviour");
assert.equal(dropped.length, 0);

// Every merged declaration carries the assert, so verify checks all of them
// rather than whichever happened to be listed first.
assert.deepEqual(
    merged[0].rules.map(rule => rule.target).sort(),
    candidates.map(c => c.identity).sort()
);

// --- the gate refusing ---

const notShared = {
    "api.py::get_agencies:function": { properties: { calls: ["get_store"], throws: 0 } },
    "api.py::get_mps:function": { properties: { calls: ["get_store"], throws: 0 } },
    "api.py::get_states:function": { properties: { calls: ["something_else"], throws: 0 } }
};

// Flat facts still work, so a caller that already unwrapped is not broken.
const flatFacts = {
    "api.py::get_agencies:function": { calls: ["get_store"] },
    "api.py::get_mps:function": { calls: ["get_store"] },
    "api.py::get_states:function": { calls: ["get_store"] }
};
assert.equal(
    normalizeBrownfieldNodes(JSON.parse(JSON.stringify(merging)), plan, candidates, [], [], {}, {}, flatFacts, {}).length,
    1,
    "the gate reads facts whether or not they arrive wrapped"
);

const refusedDropped = [];
const refused = normalizeBrownfieldNodes(
    JSON.parse(JSON.stringify(merging)), plan, candidates, refusedDropped, [], {}, {}, notShared, {}
);

assert.equal(refused.length, 3, "no single assert holds for all three, so they are drawn separately");
assert.ok(
    refused.every(node => node.identities === undefined),
    "an unmerged node carries no identities list, so an unmerged plan looks exactly as it did before merging existed"
);
assert.equal(refusedDropped.length, 1, "a refused merge is reported, never silent");
assert.match(refusedDropped[0], /without one assert true of all of them/);

// Nothing is lost when the gate refuses.
assert.deepEqual(
    refused.map(node => node.identity).sort(),
    candidates.map(c => c.identity).sort(),
    "every declaration still reaches the plan"
);

// --- the older single-declaration shape still drafts ---

const legacy = normalizeBrownfieldNodes(
    {
        nodes: [{
            identity: "api.py::get_agencies:function",
            feature: "Lookups",
            step: 1,
            title: "List the agency names",
            intent: "The reply is sorted",
            lensTags: ["backend"],
            rules: [{ kind: "behaviour", target: "api.py::get_agencies:function", assert: { returns: { op: ">=", value: 1 } } }]
        }]
    },
    plan, candidates, [], [], {}, {}, facts, {}
);

assert.equal(legacy.length, 1);
assert.equal(legacy[0].identity, "api.py::get_agencies:function");
assert.equal(legacy[0].role, "behaviour", "a node with no role stated is a step");

// --------------------------------------------------
// EDGES NEED EVIDENCE
// --------------------------------------------------

const steps = [
    { id: "plan_0001", feature: "f1", identity: "a.js::handler:function", step: 1, edgesOut: [] },
    { id: "plan_0002", feature: "f1", identity: "u.js::clean:function", step: 2, edgesOut: [] },
    { id: "plan_0003", feature: "f1", identity: "a.js::orphan:function", step: 3, edgesOut: [] }
];

linkFeatureSteps(steps, graph);

assert.deepEqual(steps[0].edgesOut, ["plan_0002"], "handler calls clean, so the edge is drawn");
assert.deepEqual(steps[1].edgesOut, [], "clean calls nothing in the feature");
assert.deepEqual(
    steps[2].edgesOut,
    [],
    "orphan follows handler in step order but calls nothing - reading order is not an arrow"
);

assert.ok(
    steps.every(node => Number.isFinite(node.step)),
    "step survives into plan.json as the reading order"
);

// A merged node owns all its declarations for linking.
const mergedSteps = [
    { id: "plan_0010", feature: "f1", identity: "a.js::handler:function", identities: ["a.js::handler:function", "a.js::orphan:function"], step: 1, edgesOut: [] },
    { id: "plan_0011", feature: "f1", identity: "u.js::clean:function", step: 2, edgesOut: [] }
];
linkFeatureSteps(mergedSteps, graph);
assert.deepEqual(mergedSteps[0].edgesOut, ["plan_0011"]);

// --------------------------------------------------
// THE PLAN SCHEMA ACCEPTS ALL OF IT
// --------------------------------------------------

assert.deepEqual(
    validatePlan({
        version: 1,
        lenses: [],
        features: [{ id: "feat_0001", name: "Lookups" }],
        nodes: merged.map(node => ({ ...node, feature: "feat_0001" }))
    }),
    []
);

console.log("PASS: roles-and-merge");
