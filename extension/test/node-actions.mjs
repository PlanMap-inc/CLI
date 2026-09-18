import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../out/cli.js";
import { buildCliArgs, isWebviewMessage } from "../out/messages.js";
import { detectApiKeySource } from "../out/state.js";
import { describeImpact, describeViolation, nodeActions, verifyResultFor } from "../webview/model.js";
import { approveNode, rejectNode, reviseNode } from "../../src/plan/approval.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../src/cli/cli.js");

const byType = node => Object.fromEntries(nodeActions(node).map(action => [action.type, action]));

// The buttons agree with the backend's own transition rules, for every status.
for (const status of ["intended", "approved", "implemented", "drifted", "error", "superseded"]) {
    const node = { id: "plan_0001", identity: "a.js::a:function", status };
    const actions = byType(node);

    assert.equal(actions.approve.enabled, approveNode(node).changed === true, `approve for ${status}`);
    assert.equal(actions.revise.enabled, reviseNode(node).changed === true, `revise for ${status}`);
    assert.equal(actions.reject.enabled, rejectNode(node, { force: true }).remove === true, `reject for ${status}`);
    assert.equal(actions.reject.message.force, status === "approved", "--force only when the backend requires it");
    assert.equal(rejectNode(node, { force: actions.reject.message.force }).remove, actions.reject.enabled, `reject flags for ${status}`);

    for (const action of Object.values(actions)) {
        if (action.enabled) assert.equal(isWebviewMessage(action.message), true, `${action.type} sends a valid message`);
        else assert.ok(action.reason.length > 0, `${action.type} explains why it is unavailable`);
    }
}

// A greenfield node (no identity) can be approved and rejected by id, but the CLI can't revise it.
const greenfield = byType({ id: "plan_0009", status: "approved" });
assert.equal(greenfield.revise.enabled, false);
assert.match(greenfield.revise.reason, /identity/);
assert.deepEqual(buildCliArgs(greenfield.reject.message, "/p"), ["reject", "/p", "plan_0009", "--force"]);

// Verify detail belongs to the exact plan node version it checked.
const verify = { results: [
    { planNodeId: "plan_0001", planVersion: 1, status: "drifted", violations: [{ field: "throws", expected: { op: "==", value: 1 }, actual: 0, reason: "throws changed" }], impact: [{ identity: "b.js::b:function", depth: 1, kind: "caller", confidence: "high" }] },
    { planNodeId: "plan_0002", planVersion: 2, status: "implemented" }
] };
assert.equal(verifyResultFor(verify, { id: "plan_0001" }).status, "drifted");
assert.equal(verifyResultFor(verify, { id: "plan_0002", version: 2 }).status, "implemented");
assert.equal(verifyResultFor(verify, { id: "plan_0002", version: 3 }), null, "a newer version was not checked");
assert.equal(verifyResultFor(null, { id: "plan_0001" }), null);
assert.deepEqual(describeViolation(verify.results[0].violations[0]), { field: "throws", expected: '{"op":"==","value":1}', actual: "0", reason: "throws changed" });
assert.deepEqual(describeImpact(verify.results[0].impact[0]), { identity: "b.js::b:function", meta: "caller · depth 1 · high confidence" });

// End to end: the messages the buttons send, run by the real CLI.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-actions-"));
const options = { nodePath: process.execPath, cliPath: CLI, cwd: root, runAsNode: false, apiKey: "", env: { PLANMAP_LLM_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions" } };
const run = message => runCli(buildCliArgs(message, root), options);
const readPlan = () => JSON.parse(fs.readFileSync(path.join(root, ".planmap", "plan.json"), "utf8"));
const planNode = id => readPlan().nodes.find(node => node.id === id);

fs.writeFileSync(path.join(root, "auth.js"), 'export function verifyToken(t) {\n    if (!t) throw new Error("bad");\n    return t;\n}\nexport function loadSession(t) { return verifyToken(t); }\nexport function logout(t) { return null; }\n');
assert.equal((await runCli(["init", root], options)).outcome, "ok");

const node = (id, name, lensTags) => ({ id, title: name, intent: `${name} works.`, feature: "auth", identity: `auth.js::${name}:function`, lensTags, edgesOut: [], status: "intended", origin: "human_authored", rules: [] });
// Test data, written by the test - the extension itself never writes plan.json.
fs.writeFileSync(path.join(root, ".planmap", "plan.json"), JSON.stringify({
    version: 1,
    lenses: [{ id: "security", label: "Security" }, { id: "business", label: "Business" }],
    features: [{ id: "auth", name: "Login" }],
    nodes: [node("plan_0001", "verifyToken", ["security"]), node("plan_0002", "loadSession", ["security", "business"]), node("plan_0003", "logout", ["business"])]
}, null, 2) + "\n");

// Approve one node by id.
assert.equal((await run(byType(planNode("plan_0001")).approve.message)).outcome, "ok");
assert.equal(planNode("plan_0001").status, "approved");

// Approve a lens: every intended node tagged security.
const lens = await run({ type: "approveLens", lensId: "security" });
assert.equal(lens.outcome, "ok");
assert.match(lens.stdout, /Approved: 1/);
assert.equal(planNode("plan_0002").status, "approved");
assert.equal(planNode("plan_0003").status, "intended", "other lenses are untouched");
assert.equal((await run({ type: "approveLens", lensId: "security" })).outcome, "nothing", "nothing left to approve is exit 2");

// Revise an approved node: a new intended version, the old one in history.
assert.equal((await run(byType(planNode("plan_0001")).revise.message)).outcome, "ok");
const revised = readPlan().nodes.find(candidate => candidate.supersedes === "plan_0001");
assert.equal(revised.status, "intended");
assert.equal(revised.version, 2);
assert.equal(revised.history.at(-1).id, "plan_0001");
assert.equal(planNode("plan_0001"), undefined);

// Reject: an intended node goes; an approved one needs --force, which the button adds.
assert.equal((await run(byType(planNode("plan_0003")).reject.message)).outcome, "ok");
assert.equal(planNode("plan_0003"), undefined);
assert.equal((await run({ type: "reject", target: "plan_0002", force: false })).outcome, "findings", "the CLI refuses without --force");
assert.equal((await run(byType(planNode("plan_0002")).reject.message)).outcome, "ok");
assert.equal(planNode("plan_0002"), undefined);

// The stored key reaches the CLI's environment; without one the CLI keeps its own lookup.
const probe = path.join(root, "probe.mjs");
fs.writeFileSync(probe, 'console.log(process.env.OPENROUTER_API_KEY === "test-key" ? "stored" : process.env.OPENROUTER_API_KEY === "" ? "blank" : "own");\n');
const probeOptions = { nodePath: process.execPath, cliPath: probe, cwd: root, runAsNode: false };
assert.equal((await runCli([], { ...probeOptions, apiKey: "test-key" })).stdout.trim(), "stored");
assert.equal((await runCli([], { ...probeOptions, apiKey: "" })).stdout.trim(), "blank");

// Where the CLI would find a key on its own - reported as a source, never the value.
assert.equal(await detectApiKeySource(root, { OPENROUTER_API_KEY: "x" }), "environment");
assert.equal(await detectApiKeySource(root, {}), null);
fs.writeFileSync(path.join(root, ".env"), "OTHER=1\nOPENROUTER_API_KEY=\n");
assert.equal(await detectApiKeySource(root, {}), null, "an empty value is no key");
fs.writeFileSync(path.join(root, ".env"), 'OPENROUTER_API_KEY="abc"\n');
assert.equal(await detectApiKeySource(root, {}), "project");

fs.rmSync(root, { recursive: true, force: true });

console.log("PASS: node-actions");
