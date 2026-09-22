import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../out/cli.js";
import { readViewState } from "../out/state.js";
import { buildConstellation, buildSpine, effectiveStatus, railModel, statusClass } from "../webview/model.js";
import { buildEvolutionTree, evolutionIcon } from "../webview/evolution.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../src/cli/cli.js");

const flatten = items => items.flatMap(item => [...(item.feature ? [] : [item]), ...flatten(item.children)]);

// One real verify run flags the same identity in both view models and on the rail.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-drift-"));
// No model is reached: an empty key on the hosted endpoint means the CLI
// labels from file paths, so these runs stay offline and deterministic.
const options = () => ({ nodePath: process.execPath, cliPath: CLI, cwd: root, runAsNode: false, apiKey: "", env: { PLANMAP_LLM_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions" } });
const source = path.join(root, "auth.js");
const identity = "auth.js::verifyToken:function";

fs.writeFileSync(source, 'export function verifyToken(token) {\n    if (!token) throw new Error("Invalid token");\n    return token;\n}\n\nexport function loadSession(token) {\n    return { token: verifyToken(token) };\n}\n');

assert.equal((await runCli(["init", root], options(false))).outcome, "ok");
assert.equal((await runCli(["evolution", root], options(true))).outcome, "ok");

// Test data, written by the test - the extension itself never writes plan.json.
fs.writeFileSync(path.join(root, ".planmap", "plan.json"), JSON.stringify({
    version: 1,
    lenses: [{ id: "security", label: "Security" }],
    features: [{ id: "auth", name: "Login" }],
    nodes: [{
        id: "plan_0001", title: "Token check", intent: "Must throw on an invalid token.", feature: "auth",
        identity, lensTags: ["security"], edgesOut: [], status: "intended", origin: "human_authored",
        rules: [{ kind: "behaviour", target: identity, assert: { throws: { op: "==", value: 1 } } }]
    }]
}, null, 2) + "\n");

assert.equal((await runCli(["approve", root, identity], options(false))).outcome, "ok");

// Break the code, then verify once.
fs.writeFileSync(source, "export function verifyToken(token) {\n    return token;\n}\n\nexport function loadSession(token) {\n    return { token: verifyToken(token) };\n}\n");
const verify = await runCli(["verify", root, "--json"], options(false));
assert.equal(verify.outcome, "findings");

const driftedIdentities = verify.json.results.filter(result => result.status === "drifted").map(result => result.identity);
assert.deepEqual(driftedIdentities, [identity]);

const state = await readViewState(root);

// Plan Graph: the node is drifted and pulses; its feature reads drifted.
const planNode = buildSpine(state.plan, "auth", { verifiedStatus: state.verifiedStatus })
    .items.find(item => item.node?.identity === identity);
assert.equal(planNode.status, "drifted");
assert.match(statusClass(planNode.status), /\bpulse\b/);
assert.equal(buildConstellation(state.plan, state.verifiedStatus).cards[0].status, "drifted");

// Evolution: the same identity shows ⚠ on its latest node, and only there.
const evolutionItems = flatten(buildEvolutionTree(state.evolution)).filter(item => item.identity === identity);
assert.ok(evolutionItems.length >= 1);
const flagged = evolutionItems.filter(item => item.status === "drifted");
assert.equal(flagged.length, 1);
assert.equal(evolutionIcon(flagged[0].status), "⚠");

// Rail: the badge count is the verify run's drift count.
assert.equal(railModel("planmap", state.verifiedStatus).badge.count, verify.json.summary.drifted);
assert.equal(railModel("evolution", state.verifiedStatus).badge.count, 1);

// The join is exact string equality on identity - all three strings are identical.
assert.equal(planNode.node.identity, flagged[0].identity);
assert.equal(flagged[0].identity, driftedIdentities[0]);

// Fix the code and verify again: both views clear together.
fs.writeFileSync(source, 'export function verifyToken(token) {\n    if (!token) throw new Error("Invalid token");\n    return token;\n}\n\nexport function loadSession(token) {\n    return { token: verifyToken(token) };\n}\n');
assert.equal((await runCli(["verify", root, "--json"], options(false))).outcome, "ok");

const fixed = await readViewState(root);
assert.equal(
    buildSpine(fixed.plan, "auth", { verifiedStatus: fixed.verifiedStatus }).items[0].status,
    "implemented"
);
assert.deepEqual(flatten(buildEvolutionTree(fixed.evolution)).filter(item => item.status === "drifted"), []);
assert.equal(railModel("planmap", fixed.verifiedStatus).badge, null);

fs.rmSync(root, { recursive: true, force: true });

// No normalising: a near-identical identity string does not match.
const planned = { id: "plan_0001", version: 1, identity, status: "approved" };
const recorded = { status: "drifted", verifiedAgainst: "plan_0001@1", ts: "" };
assert.equal(effectiveStatus(planned, { [identity]: recorded }), "drifted");
assert.equal(effectiveStatus(planned, { [`${identity} `]: recorded }), "approved");
assert.equal(effectiveStatus(planned, { [`./${identity}`]: recorded }), "approved");
assert.equal(effectiveStatus(planned, { [identity.toUpperCase()]: recorded }), "approved");

// error: red in both views, no pulse, not counted as drift.
const errored = { [identity]: { status: "error", verifiedAgainst: "plan_0001@1", ts: "" } };
assert.equal(effectiveStatus(planned, errored), "error");
assert.doesNotMatch(statusClass("error"), /pulse/);
assert.equal(evolutionIcon("error"), "✕");
assert.equal(railModel("planmap", errored).badge, null);

console.log("PASS: drift-sync");
