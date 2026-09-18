import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../out/cli.js";
import { readViewState } from "../out/state.js";
import { buildEvolutionTree, countNodes } from "../webview/evolution.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../src/cli/cli.js");

const shape = items => items.map(item => [item.feature ? `feature:${item.title}` : item.id, shape(item.children)]);

// Backend-shaped history: a "changed" or "deleted" node points at the
// "added" node for the same identity, so repeated changes are siblings.
const evolution = {
    version: 1,
    nodes: [
        { id: "n_0001", identity: "src/auth.js::verifyToken:function", type: "added", parent: null, feature: "Authentication", label: "Added verifyToken", tags: ["auth"], status: "superseded" },
        { id: "n_0002", identity: "src/auth.js::loadSession:function", type: "added", parent: null, feature: "Authentication", label: "Added loadSession", tags: ["auth"], status: "implemented" },
        { id: "n_0003", identity: "src/orders.js::createOrder:function", type: "added", parent: null, feature: "Orders", label: "Added createOrder", tags: [], status: "superseded" },
        { id: "n_0004", identity: "src/auth.js::verifyToken:function", type: "changed", parent: "n_0001", feature: "Authentication", label: "Changed verifyToken", tags: ["auth"], status: "superseded" },
        { id: "n_0005", identity: "src/auth.js::verifyToken:function", type: "changed", parent: "n_0001", feature: "Authentication", label: "Changed verifyToken", tags: ["auth"], status: "drifted" },
        { id: "n_0006", identity: "src/orders.js::createOrder:function", type: "deleted", parent: "n_0003", feature: "Orders", label: "Deleted createOrder", tags: [], status: "deleted" },
        // Orphans: a parent that does not exist, a parent filed under another feature, a loop.
        { id: "n_0007", identity: "src/orders.js::promo:function", type: "changed", parent: "n_9999", feature: "Orders", label: "Changed promo", tags: [], status: "implemented" },
        { id: "n_0008", identity: "src/pay.js::charge:function", type: "changed", parent: "n_0002", feature: "Payments", label: "Changed charge", tags: [], status: "implemented" },
        { id: "n_0009", identity: "a.js::a:function", type: "changed", parent: "n_0010", label: "Loop A" },
        { id: "n_0010", identity: "b.js::b:function", type: "changed", parent: "n_0009" }
    ]
};

const tree = buildEvolutionTree(evolution);

assert.deepEqual(shape(tree), [
    ["feature:Authentication", [
        ["n_0001", [["n_0004", []], ["n_0005", []]]],
        ["n_0002", []]
    ]],
    ["feature:Orders", [
        ["n_0003", [["n_0006", []]]],
        ["n_0007", []]
    ]],
    ["feature:Payments", [["n_0008", []]]],
    ["feature:Unclassified", [["n_0009", []], ["n_0010", []]]]
]);

assert.equal(countNodes(tree), evolution.nodes.length, "every evolution node appears exactly once");

const byId = Object.fromEntries(tree.flatMap(group => group.children.flatMap(item => [item, ...item.children])).map(item => [item.id, item]));
assert.equal(byId.n_0005.title, "Changed verifyToken", "rows are titled by label");
assert.equal(byId.n_0010.title, "b.js::b:function", "without a label, the identity names the row");
assert.equal(byId.n_0005.identity, "src/auth.js::verifyToken:function");
assert.equal(byId.n_0005.status, "drifted");

assert.deepEqual(buildEvolutionTree(null), []);
assert.deepEqual(buildEvolutionTree({ nodes: "not an array" }), []);

// The same shape from a real, offline CLI run.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-evo-"));
const options = { nodePath: process.execPath, cliPath: CLI, cwd: root, runAsNode: false, apiKey: "", env: { PLANMAP_LLM_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions" } };

fs.writeFileSync(path.join(root, "auth.js"), "export function verifyToken(t) { return t; }\nexport function loadSession(t) { return verifyToken(t); }\n");
fs.writeFileSync(path.join(root, "orders.js"), "export function createOrder(c) { return c; }\n");

assert.equal((await runCli(["init", root], options)).outcome, "ok");
assert.equal((await runCli(["evolution", root], options)).outcome, "ok");

const state = await readViewState(root);
const real = buildEvolutionTree(state.evolution);

assert.ok(state.declarationCount > 0);
assert.equal(countNodes(real), state.evolution.nodes.length);
assert.equal(countNodes(real), state.declarationCount, "a first scan records one added node per declaration");
assert.ok(real.every(group => group.feature && group.children.every(item => item.children.length === 0)), "a first scan has no changes to nest");

fs.rmSync(root, { recursive: true, force: true });

console.log("PASS: evolution-render");
