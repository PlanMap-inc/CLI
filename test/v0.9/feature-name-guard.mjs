import assert from "node:assert/strict";

import { applyEvolutionClassification } from "../../src/evolution/classification.js";
import { isLayerName } from "../../src/llm/lenses.js";

// isLayerName already knows "server" is a layer name, not a capability -
// confirmed by reading src/llm/lenses.js before writing this test. This
// assertion protects that fact rather than restating it as a new rule.
assert.equal(isLayerName("Server"), true);
assert.equal(isLayerName("Login"), false);

// --------------------------------------------------
// A LAYER NAME NEVER OVERWRITES AN EXISTING CLASSIFICATION
// --------------------------------------------------

const evolution = {
    version: 1,
    nodes: [
        { ts: "2026-01-01T00:00:00Z", identity: "server.js::startServer:function", labelSource: "path", tagSource: "path", feature: "Login" }
    ]
};

const classifications = [
    { ts: "2026-01-01T00:00:00Z", identity: "server.js::startServer:function", category: "Server", label: "Bind the configured port", tags: ["backend"] }
];

applyEvolutionClassification(evolution, classifications, []);

const node = evolution.nodes[0];
assert.equal(node.feature, "Login", "a layer name from the model must not overwrite the node's existing feature - here, its prior classification");
assert.notEqual(node.category, "Server");
assert.equal(node.label, "Bind the configured port", "the label and tags are a different axis and still update normally");

// --------------------------------------------------
// AN ORDINARY CAPABILITY NAME STILL WORKS EXACTLY AS BEFORE
// --------------------------------------------------

const ordinary = {
    version: 1,
    nodes: [{ ts: "2026-01-01T00:00:00Z", identity: "auth.js::startAuth:function", labelSource: "path", tagSource: "path" }]
};

applyEvolutionClassification(
    ordinary,
    [{ ts: "2026-01-01T00:00:00Z", identity: "auth.js::startAuth:function", category: "Login", label: "Start Google sign-in", tags: ["security"] }],
    []
);

assert.equal(ordinary.nodes[0].feature, "Login");

console.log("PASS: feature-name-guard");
