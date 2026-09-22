import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { validatePlan } from "../../src/plan/model.js";
import { nodeIdentities } from "../../src/plan/nodes.js";
import { runCli, ROOT } from "../helpers/run-cli.mjs";

// --------------------------------------------------
// A WHOLE DRAFT, CAPPED
// --------------------------------------------------
// 25 significant declarations in one feature, drafted in one batch and
// then folded. The point of running the real command rather than the pure
// function is the wiring: the cap has to run AFTER the last batch, its
// summary steps have to be linked and validated, and the whole plan has
// to be written once.
//
// The model is mocked. One reply serves both requests the run makes: the
// draft reads "nodes" and ignores everything else, and the titling reads
// "steps" and ignores everything else.
// --------------------------------------------------

const COUNT = 25;
const CAP = 20;

const PARTS = ["Read", "Shape", "Write"];

const named = index => `readRow${String(index).padStart(2, "0")}`;
const identityOf = index => `src/store.js::${named(index)}:function`;
const partOf = index => PARTS[index % PARTS.length];

// Each declaration returns something and calls nothing, so nothing folds
// by the call tree - the parts and the neighbours do the work here.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-cap-"));

fs.mkdirSync(path.join(root, "src"), { recursive: true });

fs.writeFileSync(
    path.join(root, "src", "store.js"),
    Array.from({ length: COUNT }, (_, at) =>
        `export function ${named(at + 1)}() {\n    return ${at + 1};\n}\n`).join("\n")
);

assert.equal(runCli(["init", root], ROOT).code, 0, "init must succeed");

fs.writeFileSync(
    path.join(root, ".planmap", "evolution.json"),
    JSON.stringify({
        version: 1,
        nodes: Array.from({ length: COUNT }, (_, at) => ({
            id: `evo_${String(at + 1).padStart(4, "0")}`,
            ts: "2026-09-05T00:00:00.000Z",
            type: "added",
            identity: identityOf(at + 1),
            labelSource: "llm",
            feature: "Data Store",
            path: [partOf(at + 1)]
        }))
    }, null, 2)
);

// One reply, two readers. The step keys cover every id a summary step
// could be handed, so the titling is genuinely exercised rather than
// silently falling back.
const response = JSON.stringify({
    nodes: Array.from({ length: COUNT }, (_, at) => ({
        identity: identityOf(at + 1),
        feature: "Data Store",
        role: "behaviour",
        step: at + 1,
        title: `Record the row ${at + 1} entry`,
        intent: `Row ${at + 1} is written once`,
        lensTags: ["backend"],
        rules: [
            {
                kind: "behaviour",
                target: identityOf(at + 1),
                assert: { returns: { op: ">=", value: 1 } }
            }
        ]
    })),
    steps: Array.from({ length: 60 }, (_, at) => ({
        key: `plan_${String(at + 1).padStart(4, "0")}`,
        title: "Read the stored rows in order",
        intent: "A run of stored rows is read together."
    }))
});

const drafted = runCli(
    ["plan", "draft", root],
    root,
    { apiKey: "test-key", response, mock: true, env: { PLANMAP_LLM_BATCH_SIZE: "50" } }
);

assert.equal(drafted.code, 0, `draft failed:\n${drafted.stdout}\n${drafted.stderr}`);

const plan = JSON.parse(fs.readFileSync(path.join(root, ".planmap", "plan.json"), "utf8"));


// --------------------------------------------------
// THE PLAN IS VALID, AND INSIDE THE CAP
// --------------------------------------------------

assert.deepEqual(
    validatePlan(plan),
    [],
    "the plan written at the end of a capped draft must validate"
);

const steps = plan.nodes.filter(node => node.role === "behaviour");

assert.ok(
    steps.length <= CAP,
    `a feature must not hold more than ${CAP} steps, it holds ${steps.length}`
);

assert.equal(
    new Set(steps.map(node => node.feature)).size,
    1,
    "the fixture is one feature, so the cap applies to one feature"
);


// --------------------------------------------------
// SUMMARY STEPS LOOK LIKE SUMMARY STEPS
// --------------------------------------------------

const summaries = plan.nodes.filter(node => node.merge === "summary");

assert.ok(summaries.length > 0, "25 steps over a cap of 20 must produce summary steps");

for (const summary of summaries) {
    assert.ok(Array.isArray(summary.summaryOf) && summary.summaryOf.length > 1,
        `${summary.id} must say what it covers`);

    assert.ok(summary.identities.length > 1);
    assert.equal(summary.identity, summary.identities[0]);
    assert.equal(summary.role, "behaviour");
    assert.equal(summary.status, "intended");

    for (const entry of summary.summaryOf) {
        assert.ok(entry.title, "every covered step keeps its title");

        for (const identity of entry.identities) {
            assert.ok(summary.identities.includes(identity),
                "a covered step names only declarations the summary stands for");
        }
    }
}

// The mocked titles were accepted, not quietly ignored.
assert.ok(
    summaries.some(summary => summary.title === "Read the stored rows in order"),
    "the mocked summary titles must be used"
);


// --------------------------------------------------
// NOTHING IS LOST
// --------------------------------------------------

const held = plan.nodes.flatMap(nodeIdentities);

assert.equal(new Set(held).size, held.length, "no declaration appears on two nodes");

const expected = Array.from({ length: COUNT }, (_, at) => identityOf(at + 1));

assert.deepEqual(
    [...held].sort(),
    expected.sort(),
    "every drafted declaration is still in the plan after the cap"
);

const targets = plan.nodes.flatMap(node => (node.rules ?? []).map(rule => rule.target));

assert.deepEqual(
    [...new Set(targets)].sort(),
    expected.sort(),
    "every declaration still has a rule of its own"
);


// --------------------------------------------------
// THE RUN SAYS WHAT IT DID
// --------------------------------------------------

assert.match(
    drafted.stdout,
    /Data Store: 25 steps → \d+ \(\d+ summary steps\)/,
    `the cap must report itself:\n${drafted.stdout}`
);

console.log("PASS: draft-cap-end-to-end");
