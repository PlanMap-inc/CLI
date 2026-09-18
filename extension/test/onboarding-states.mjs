import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../out/cli.js";
import { buildCliArgs } from "../out/messages.js";
import { planShapeProblem, readViewState } from "../out/state.js";
import { onboardingState } from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../src/cli/cli.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-onboard-"));
// No model is reached: an empty key on the hosted endpoint means the CLI
// labels from file paths, so these runs stay offline and deterministic.
const options = { nodePath: process.execPath, cliPath: CLI, cwd: root, runAsNode: false, apiKey: "", env: { PLANMAP_LLM_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions" } };

fs.writeFileSync(path.join(root, "a.js"), "export function a() { return 1; }\nexport function b() { return a(); }\n");

// State A - no .planmap/.
assert.deepEqual(onboardingState(await readViewState(root)), { kind: "scan" });

// "Scan project" is init, then evolution.
assert.equal((await runCli(["init", root], options)).outcome, "ok");

// State B - scanned, no plan.json. The count is baseline.json declarations.length.
const baseline = JSON.parse(fs.readFileSync(path.join(root, ".planmap", "baseline.json"), "utf8"));
const scanned = await readViewState(root);
assert.equal(scanned.setup, "no-plan");
assert.ok(baseline.declarations.length > 0);
assert.deepEqual(onboardingState(scanned), { kind: "no-plan", declarations: baseline.declarations.length });

assert.equal((await runCli(["evolution", root], options)).outcome, "ok");
assert.equal(onboardingState(await readViewState(root)).kind, "no-plan", "evolution alone is not a plan");

// "Draft a plan with AI" with no key: exit 2 with the CLI's own message, not a crash.
assert.deepEqual(buildCliArgs({ type: "draftPlan" }, root), ["plan", "draft", root]);
const draft = await runCli(["plan", "draft", root], options);
assert.equal(draft.code, 2);
assert.equal(draft.outcome, "nothing");
assert.match(draft.stderr, /Cannot draft: OPENROUTER_API_KEY is not configured\./);

// The default is a local model. With none running, the scan says so and
// keeps path labels rather than failing silently.
const offline = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-nomodel-"));
fs.writeFileSync(path.join(offline, "b.js"), "export function b() { return 2; }\n");

const offlineOptions = {
    ...options,
    cwd: offline,
    env: { PLANMAP_LLM_ENDPOINT: "http://localhost:59999/v1/chat/completions" }
};

assert.equal((await runCli(["init", offline], offlineOptions)).outcome, "ok");

const unreachable = await runCli(["evolution", offline], offlineOptions);
const said = unreachable.stdout + unreachable.stderr;
assert.match(said, /Cannot reach the model at http:\/\/localhost:59999/);
assert.match(said, /ollama serve/);
assert.match(said, /fell back to path labels/);

fs.rmSync(offline, { recursive: true, force: true });
assert.equal(fs.existsSync(path.join(root, ".planmap", "plan.json")), false, "a failed draft writes no plan");

// "Write one rule myself" offers this skeleton; it must be a valid plan.
const extensionSource = fs.readFileSync(path.resolve(HERE, "../src/extension.ts"), "utf8");
const skeletonText = extensionSource.match(/const PLAN_SKELETON = '([^']+)\\n';/)[1];
const skeleton = JSON.parse(skeletonText);
assert.deepEqual(skeleton, { version: 1, lenses: [], features: [], nodes: [] });
assert.equal(planShapeProblem(skeleton), null);
assert.equal(buildCliArgs({ type: "openPlan" }, root), null, "opening the plan is not a CLI call");

// State C - the user saved the skeleton (the test writes it here as test data); nothing verified yet.
fs.writeFileSync(path.join(root, ".planmap", "plan.json"), skeletonText + "\n");
const planned = await readViewState(root);
assert.equal(planned.setup, "ready");
assert.deepEqual(onboardingState(planned), { kind: "verify" });

fs.rmSync(root, { recursive: true, force: true });

// Once verify has recorded anything, onboarding is over.
assert.equal(onboardingState({ setup: "ready", verifiedStatus: { "a.js::a:function": { status: "implemented" } } }), null);
assert.deepEqual(onboardingState({ setup: "invalid-plan", problem: "bad" }), { kind: "invalid-plan", problem: "bad" });
assert.equal(onboardingState(null), null);

// The copy and the buttons the brief specifies.
const main = fs.readFileSync(path.resolve(HERE, "../webview/main.js"), "utf8");
for (const text of [
    "PlanMap isn't set up yet",
    "Scan this project to learn what your code currently does.",
    '"Scan project"',
    "Takes ~10s · nothing leaves your machine",
    "declarations\"} found",
    ", no plan yet.",
    "Draft a plan with AI",
    "needs OPENROUTER_API_KEY",
    "Write one rule myself",
    "no key needed",
    "This plan hasn't been checked against your code yet",
    "Verify against code"
]) {
    assert.ok(main.includes(text), `main.js is missing "${text}"`);
}
assert.match(main, /request\("scan", \{ type: "init" \}\)/);
assert.match(main, /if \(result\.outcome === "ok"\) vscode\.postMessage\(\{ type: "evolution" \}\);/, "scan runs evolution after a successful init");
assert.match(main, /vscode\.postMessage\(\{ type: "openPlan" \}\)/);

console.log("PASS: onboarding-states");
