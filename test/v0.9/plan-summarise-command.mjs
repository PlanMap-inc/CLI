import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scanProject } from "../../src/baseline/scanner.js";
import { validatePlan } from "../../src/plan/model.js";
import { nodeIdentities } from "../../src/plan/nodes.js";
import { runCli } from "../helpers/run-cli.mjs";

// --------------------------------------------------
// THE CAP, ON A PLAN THAT ALREADY EXISTS
// --------------------------------------------------
// `plan draft` folds at the end of its own run. A plan drafted before the
// cap existed never gets that, so the same pass is a command of its own.
//
// It has to be safe to run twice. A command that folds a little more each
// time it is run is a command nobody can run, because the plan would drift
// under whoever ran it last - so a feature that already fits is left
// exactly as it is, summary steps and all.
//
// No key is configured, so every summary step keeps its deterministic
// fallback title. The model is never reached.
// --------------------------------------------------

const COUNT = 30;
const CAP = 20;

const PARTS = ["Read", "Shape", "Write"];

const named = index => `readRow${String(index).padStart(2, "0")}`;
const identityOf = index => `src/store.js::${named(index)}:function`;

function project() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-summarise-"));

    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.join(root, ".planmap"));

    fs.writeFileSync(
        path.join(root, "src", "store.js"),
        Array.from({ length: COUNT }, (_, at) =>
            `export function ${named(at + 1)}() {\n    return ${at + 1};\n}\n`).join("\n")
    );

    const write = (name, value) =>
        fs.writeFileSync(path.join(root, ".planmap", name), JSON.stringify(value, null, 2));

    write("baseline.json", { version: 2, declarations: scanProject(root, { quiet: true }) });

    write("plan.json", {
        version: 1,
        lenses: [],
        features: [{ id: "f1", name: "Data Store" }],
        nodes: Array.from({ length: COUNT }, (_, at) => ({
            id: `plan_${String(at + 1).padStart(4, "0")}`,
            feature: "f1",
            identity: identityOf(at + 1),
            role: "behaviour",
            title: `Record the row ${at + 1} entry`,
            intent: `Row ${at + 1} is written once`,
            step: at + 1,
            path: [PARTS[(at + 1) % PARTS.length]],
            lensTags: ["backend"],
            rules: [
                {
                    kind: "behaviour",
                    target: identityOf(at + 1),
                    assert: { returns: { op: ">=", value: 1 } }
                }
            ],
            status: "intended",
            origin: "ai_drafted",
            edgesOut: []
        }))
    });

    return root;
}

const readPlanFile = root =>
    JSON.parse(fs.readFileSync(path.join(root, ".planmap", "plan.json"), "utf8"));

const root = project();

const before = readPlanFile(root);

assert.equal(before.nodes.length, COUNT, "the fixture starts over the cap");


// --------------------------------------------------
// FIRST RUN
// --------------------------------------------------

const first = runCli(["plan", "summarise", root], root, { apiKey: "" });

assert.equal(first.code, 0, `plan summarise failed:\n${first.stdout}\n${first.stderr}`);

assert.match(
    first.stdout,
    /Data Store: 30 steps → 20 \(\d+ summary steps\)/,
    `the run must report what it did:\n${first.stdout}`
);

const capped = readPlanFile(root);

assert.deepEqual(validatePlan(capped), [], "the written plan must validate");

assert.equal(
    capped.nodes.filter(node => node.role === "behaviour").length,
    CAP,
    "the feature must come out at the cap"
);

assert.ok(
    capped.nodes.some(node => node.merge === "summary"),
    "folding 30 into 20 must produce summary steps"
);

// Nothing lost, and no rule re-targeted.
const held = capped.nodes.flatMap(nodeIdentities);
const expected = Array.from({ length: COUNT }, (_, at) => identityOf(at + 1));

assert.equal(new Set(held).size, held.length, "no declaration appears twice");
assert.deepEqual([...held].sort(), expected.sort(), "every declaration survives");

assert.deepEqual(
    capped.nodes.flatMap(node => (node.rules ?? []).map(rule => rule.target)).sort(),
    expected.sort(),
    "every rule keeps its own target"
);

// The features list is not disturbed.
assert.deepEqual(capped.features, before.features);

// With no key, every summary step kept its deterministic fallback title.
assert.match(
    first.stdout,
    /Summary steps named from their own parts, not the model/,
    "the run says the titles came from the fallback"
);

for (const summary of capped.nodes.filter(node => node.merge === "summary")) {
    assert.ok(summary.title, `${summary.id} has a title`);
    assert.ok(summary.intent, `${summary.id} has an intent`);
}


// --------------------------------------------------
// SECOND RUN CHANGES NOTHING
// --------------------------------------------------

const second = runCli(["plan", "summarise", root], root, { apiKey: "" });

assert.equal(second.code, 0, `the second run failed:\n${second.stdout}\n${second.stderr}`);

assert.match(
    second.stdout,
    /already inside the step cap/,
    `a plan that already fits must say so:\n${second.stdout}`
);

assert.deepEqual(
    readPlanFile(root),
    capped,
    "running the cap twice must leave the plan byte-for-byte the same"
);


// --------------------------------------------------
// A PLAN THAT ALREADY FITS IS NEVER TOUCHED
// --------------------------------------------------

{
    const small = project();

    const plan = readPlanFile(small);

    fs.writeFileSync(
        path.join(small, ".planmap", "plan.json"),
        JSON.stringify({ ...plan, nodes: plan.nodes.slice(0, 12) }, null, 2)
    );

    const kept = readPlanFile(small);

    const result = runCli(["plan", "summarise", small], small, { apiKey: "" });

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /already inside the step cap/);
    assert.deepEqual(readPlanFile(small), kept, "a feature under the cap is left alone");
}

console.log("PASS: plan-summarise-command");
