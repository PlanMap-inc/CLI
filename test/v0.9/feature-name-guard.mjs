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

// --------------------------------------------------
// FALLBACK BRANCH: A LAYER NAME NEVER OVERWRITES AN EXISTING CLASSIFICATION
// --------------------------------------------------

const fallbackLayerName = {
    version: 1,
    nodes: [
        { ts: "2026-01-01T00:00:00Z", identity: "server.js::setupInfra:function", labelSource: "path", tagSource: "path", feature: "Bootstrap" }
    ]
};

// Empty classifications so the function skips the LLM path and falls through to fallback
applyEvolutionClassification(
    fallbackLayerName,
    [],
    [{ ts: "2026-01-01T00:00:00Z", identity: "server.js::setupInfra:function", category: "Infrastructure", label: "Set up infrastructure", tags: ["backend"] }]
);

const fallbackNode = fallbackLayerName.nodes[0];
assert.equal(fallbackNode.feature, "Bootstrap", "a layer name from fallback must not overwrite the node's existing feature");
assert.notEqual(fallbackNode.category, "Infrastructure");
assert.equal(fallbackNode.label, "Set up infrastructure", "the label and tags are a different axis and still update normally");

// --------------------------------------------------
// FALLBACK BRANCH: AN ORDINARY CAPABILITY NAME STILL WORKS EXACTLY AS BEFORE
// --------------------------------------------------

const fallbackOrdinary = {
    version: 1,
    nodes: [{ ts: "2026-01-01T00:00:00Z", identity: "config.js::setupConfig:function", labelSource: "path", tagSource: "path" }]
};

// Empty classifications so the function skips the LLM path and falls through to fallback
applyEvolutionClassification(
    fallbackOrdinary,
    [],
    [{ ts: "2026-01-01T00:00:00Z", identity: "config.js::setupConfig:function", category: "Configuration", label: "Load config from environment", tags: ["backend"] }]
);

assert.equal(fallbackOrdinary.nodes[0].feature, "Configuration", "ordinary fallback category should classify normally");

console.log("PASS: feature-name-guard");
