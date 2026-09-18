import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../out/cli.js";
import { applyPlanValidation, readViewState } from "../out/state.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../src/cli/cli.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-validate-"));
// No model is reached: an empty key on the hosted endpoint means the CLI
// labels from file paths, so these runs stay offline and deterministic.
const options = { nodePath: process.execPath, cliPath: CLI, cwd: root, runAsNode: false, apiKey: "", env: { PLANMAP_LLM_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions" } };
const planPath = path.join(root, ".planmap", "plan.json");
const validate = () => runCli(["plan", "validate", root, "--json"], options);

fs.writeFileSync(path.join(root, "a.js"), "export function a() { return 1; }\n");
assert.equal((await runCli(["init", root], options)).outcome, "ok");

// Test data, written by the test - the extension itself never writes plan.json.
const plan = {
    version: 1,
    lenses: [{ id: "backend", label: "Backend" }],
    features: [{ id: "feat_0001", name: "Numbers", status: "intended" }],
    nodes: [{
        id: "plan_0001", title: "Returns one", intent: "a() returns a value.", feature: "feat_0001",
        identity: "a.js::a:function", lensTags: ["backend"], edgesOut: [], status: "intended", origin: "human_authored",
        rules: [{ kind: "behaviour", target: "a.js::a:function", assert: { returns: { op: ">=", value: 1 } } }]
    }]
};
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

// A plan the CLI accepts stays on the map.
const valid = await readViewState(root);
const validCheck = await validate();
assert.equal(validCheck.outcome, "ok");
assert.equal(validCheck.json.valid, true);
assert.equal(applyPlanValidation(valid, validCheck), valid);

// A plan the UI's own shape check accepts but the CLI rejects.
plan.features[0].status = "in-progress";
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

const read = await readViewState(root);
assert.equal(read.setup, "ready", "the extension's light check alone would draw this plan");

const check = await validate();
assert.equal(check.outcome, "findings");

const shown = applyPlanValidation(read, check);
assert.equal(shown.setup, "invalid-plan");
assert.equal(shown.plan, null, "no nodes are drawn that the CLI can't act on");
assert.match(shown.problem, /features\[0\]\.status is invalid/);
assert.equal(shown.evolution, read.evolution, "Project Evolution is unaffected");

// Why it matters: on this file every command sees an empty plan.
const approve = await runCli(["approve", root, "plan_0001"], options);
assert.notEqual(approve.outcome, "ok");
assert.match(approve.stderr, /Plan node not found: plan_0001/);

// A CLI without "plan validate", or a state that isn't a drawn plan, is left as it is.
assert.equal(applyPlanValidation(read, { outcome: "failed", json: undefined }), read);
const noPlan = { ...read, setup: "no-plan", plan: null };
assert.equal(applyPlanValidation(noPlan, check), noPlan);

// The host runs the check on every reload.
const host = fs.readFileSync(path.resolve(HERE, "../src/extension.ts"), "utf8");
assert.match(host, /applyPlanValidation\(read, await runCli\(\["plan", "validate", this\.projectRoot, "--json"\], this\.cliOptions\(\)\)\)/);

fs.rmSync(root, { recursive: true, force: true });

console.log("PASS: plan-validation");
