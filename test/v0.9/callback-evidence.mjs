import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanProject } from "../../src/baseline/scanner.js";
import { buildCallGraph } from "../../src/baseline/callgraph.js";
import { linkFeatureSteps } from "../../src/plan/draft.js";
import { evidenceLines } from "../../extension/webview/model.js";

// --------------------------------------------------
// A CALLBACK REGISTRATION IS REAL EVIDENCE, NOT A CALL
// --------------------------------------------------
// window.onload never invokes handleCredentialResponse - it hands the bare
// function reference to google.accounts.id.initialize as the value of a
// "callback" property. That is a real relationship (this step wires up the
// thing that later runs that one), but it is not a call_expression, so the
// existing "calls" extraction never saw it. This is the fixture pattern
// behind the real AI_Coding_Survey project's Frontend/script.js.
// --------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "deps", "callbacks");

const declarations = scanProject(projectRoot);

const setupFn = declarations.find(d => d.identity.endsWith("::setup:function"));
const plainFn = declarations.find(d => d.identity.endsWith("::plain:function"));

assert.ok(setupFn, "setup() must be found by the scanner");
assert.ok(plainFn, "plain() must be found by the scanner");

assert.deepEqual(
    setupFn.properties.callbacks,
    ["handleCredentialResponse"],
    "setup() hands handleCredentialResponse to initialize() as a callback property"
);

assert.deepEqual(
    plainFn.properties.callbacks,
    [],
    "a declaration with no object-literal callback property has an empty list, never invented"
);

// --------------------------------------------------
// THE CALL GRAPH DRAWS A REAL EDGE FROM IT
// --------------------------------------------------

const graph = buildCallGraph(declarations);

const handlerIdentity = declarations.find(d => d.identity.endsWith("::handleCredentialResponse:function")).identity;

assert.ok(
    graph.callees.get(setupFn.identity).has(handlerIdentity),
    "the call graph must resolve the callback reference into a real edge, the same as it resolves a direct call"
);

// --------------------------------------------------
// linkFeatureSteps NEEDS NO CHANGES - THE EDGE ARRIVES THROUGH callGraph
// --------------------------------------------------

const nodes = [
    { id: "plan_0001", feature: "login", identity: setupFn.identity, step: 1, edgesOut: [] },
    { id: "plan_0002", feature: "login", identity: handlerIdentity, step: 2, edgesOut: [] }
];

linkFeatureSteps(nodes, graph);

assert.deepEqual(
    nodes[0].edgesOut,
    ["plan_0002"],
    "the Feature Flow must draw a real edge from a callback registration, exactly as it would from a direct call"
);

// --------------------------------------------------
// THE EVIDENCE LINE IS HONEST - "registers", NOT "calls"
// --------------------------------------------------

assert.deepEqual(
    evidenceLines({ callbacks: ["handleCredentialResponse"] }),
    ["registers handleCredentialResponse as a callback"],
    "the card must say what actually happens - a reference handed off, not an invocation"
);

assert.deepEqual(evidenceLines({}), [], "no callbacks fact means no line, never invented");

console.log("PASS: callback-evidence");
