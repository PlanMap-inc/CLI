import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { latestVerifiedStatus, planShapeProblem, readViewState } from "../out/state.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-state-"));
const planmap = path.join(root, ".planmap");

// No .planmap/ at all.
assert.equal((await readViewState(root)).setup, "missing");

// Scanned, but no plan yet.
fs.mkdirSync(planmap);
assert.equal((await readViewState(root)).setup, "no-plan");

// A broken plan is reported, not silently shown as an empty map.
fs.writeFileSync(path.join(planmap, "plan.json"), "{ not json");
const broken = await readViewState(root);
assert.equal(broken.setup, "invalid-plan");
assert.match(broken.problem, /could not be read/);

fs.writeFileSync(path.join(planmap, "plan.json"), JSON.stringify({ version: 1, lenses: [], features: {} }));
const wrongShape = await readViewState(root);
assert.equal(wrongShape.setup, "invalid-plan");
assert.equal(wrongShape.problem, 'plan.json "features" must be an array.');

assert.equal(planShapeProblem({ version: 1, lenses: [], features: [], nodes: [] }), null);

// A valid plan, with evolution statuses from both verify and the evolution command.
const plan = { version: 1, lenses: [], features: [{ id: "f", name: "F" }], nodes: [] };
fs.writeFileSync(path.join(planmap, "plan.json"), JSON.stringify(plan));
fs.writeFileSync(path.join(planmap, "evolution.json"), JSON.stringify({
    version: 1,
    nodes: [
        { identity: "a.js::a:function", ts: "2026-01-01T00:00:00Z", status: "superseded", statusSource: "verified" },
        { identity: "a.js::a:function", ts: "2026-02-01T00:00:00Z", status: "drifted", statusSource: "verified", verifiedAgainst: "plan_0001@1" },
        { identity: "b.js::b:function", ts: "2026-02-01T00:00:00Z", status: "implemented", statusSource: "derived" },
        { identity: "c.js::c:function", ts: "2026-01-01T00:00:00Z", status: "drifted", statusSource: "verified", verifiedAgainst: "plan_0003@1" },
        { identity: "c.js::c:function", ts: "2026-03-01T00:00:00Z", status: "implemented", statusSource: "verified", verifiedAgainst: "plan_0003@1" }
    ]
}));

const ready = await readViewState(root);
assert.equal(ready.setup, "ready");
assert.deepEqual(ready.plan, plan);
assert.equal(ready.problem, null);
assert.deepEqual(Object.keys(ready.verifiedStatus).sort(), ["a.js::a:function", "c.js::c:function"], "derived statuses are not verification");
assert.equal(ready.verifiedStatus["a.js::a:function"].status, "drifted");
assert.equal(ready.verifiedStatus["c.js::c:function"].status, "implemented", "the latest verify result wins");

// A malformed evolution.json does not hide the plan.
fs.writeFileSync(path.join(planmap, "evolution.json"), "{ broken");
const noEvolution = await readViewState(root);
assert.equal(noEvolution.setup, "ready");
assert.deepEqual(noEvolution.verifiedStatus, {});

assert.deepEqual(latestVerifiedStatus(null), {});

fs.rmSync(root, { recursive: true, force: true });

console.log("PASS: view-state");
