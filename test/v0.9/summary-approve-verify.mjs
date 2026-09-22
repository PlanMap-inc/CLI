import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scanProject } from "../../src/baseline/scanner.js";
import { verifyPlan } from "../../src/verification/engine.js";
import { applyVerificationStatus } from "../../src/evolution/status.js";
import { runCli } from "../helpers/run-cli.mjs";

// --------------------------------------------------
// A SUMMARY STEP IS STILL CHECKED DECLARATION BY DECLARATION
// --------------------------------------------------
// Folding steps together is only safe while approving one still approves
// all of its code, and while a change to any of it is still caught and
// still named. If the second declaration of a summary step were measured
// against the first one's snapshot - or not measured at all - the cap
// would be a way to stop looking at code.
//
// The three things this proves:
//   - approve snapshots EVERY declaration, not only the first
//   - an "unchanged" rule on a secondary declaration passes, and then
//     drifts when that declaration changes, naming that declaration
//   - Project Evolution marks THAT declaration's row drifted, and leaves
//     the primary's alone
// --------------------------------------------------

const PRIMARY = "store.js::readOrders:function";
const SECONDARY = "store.js::readInvoices:function";

const SOURCE = `export function readOrders() {
    return fetchRows("orders");
}

export function readInvoices() {
    return fetchRows("invoices");
}

export function fetchRows(name) {
    return [name];
}
`;

// readInvoices gains a call. Nothing else in the file moves.
const CHANGED = SOURCE.replace(
    `    return fetchRows("invoices");`,
    `    audit("invoices");\n    return fetchRows("invoices");`
) + `
export function audit(name) {
    return name;
}
`;

const summaryNode = {
    id: "plan_0001",
    feature: "f1",
    identity: PRIMARY,
    identities: [PRIMARY, SECONDARY],
    merge: "summary",
    role: "behaviour",
    title: "Read the stored order records",
    intent: "Orders and invoices are read the same way",
    step: 1,
    path: ["Read"],
    summaryOf: [
        { identities: [PRIMARY], title: "Read the order rows" },
        { identities: [SECONDARY], title: "Read the invoice rows" }
    ],
    rules: [
        {
            kind: "behaviour",
            target: PRIMARY,
            assert: { calls: { op: "unchanged" } }
        },
        {
            kind: "behaviour",
            target: SECONDARY,
            assert: { calls: { op: "unchanged" } }
        }
    ],
    status: "intended",
    origin: "ai_drafted",
    edgesOut: []
};

function project(source = SOURCE) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-summary-"));

    fs.mkdirSync(path.join(root, ".planmap"));
    fs.writeFileSync(path.join(root, "store.js"), source);

    const write = (name, value) =>
        fs.writeFileSync(
            path.join(root, ".planmap", name),
            JSON.stringify(value, null, 2)
        );

    write("baseline.json", { version: 2, declarations: scanProject(root, { quiet: true }) });

    write("plan.json", {
        version: 1,
        lenses: [],
        features: [{ id: "f1", name: "Store" }],
        nodes: [summaryNode]
    });

    write("evolution.json", {
        version: 1,
        nodes: [
            {
                id: "evo_0001",
                identity: PRIMARY,
                type: "added",
                ts: "2026-09-01T00:00:00.000Z",
                feature: "Store"
            },
            {
                id: "evo_0002",
                identity: SECONDARY,
                type: "added",
                ts: "2026-09-01T00:00:00.000Z",
                feature: "Store"
            }
        ],
        edges: []
    });

    return root;
}

const readPlanFile = root =>
    JSON.parse(fs.readFileSync(path.join(root, ".planmap", "plan.json"), "utf8"));


// --------------------------------------------------
// APPROVE SNAPSHOTS EVERY DECLARATION
// --------------------------------------------------

const root = project();

const approved = runCli(["approve", root, PRIMARY], root, { apiKey: "" });

assert.equal(approved.code, 0, `approve failed: ${approved.stderr}`);

const node = readPlanFile(root).nodes[0];

assert.equal(node.status, "approved");

assert.deepEqual(
    Object.keys(node.approvedFactsByIdentity).sort(),
    [PRIMARY, SECONDARY].sort(),
    "every declaration the step stands for gets its own snapshot"
);

assert.deepEqual(
    node.approvedFactsByIdentity[PRIMARY],
    node.approvedFacts,
    "the primary's snapshot is the node's own approvedFacts"
);

// The WHOLE properties object, not the ten fields it used to copy.
for (const field of ["entryCount", "entries", "callbacks"]) {
    const declaration = scanProject(root, { quiet: true })
        .find(candidate => candidate.identity === PRIMARY);

    assert.equal(
        field in node.approvedFacts,
        field in declaration.properties,
        `approvedFacts must mirror the declaration's properties for ${field}`
    );
}

assert.equal(node.approvedFacts.callbacks !== undefined, true, "callbacks is now snapshotted");


// --------------------------------------------------
// A DECLARATION MISSING FROM THE BASELINE IS REFUSED, BY NAME
// --------------------------------------------------

{
    const partial = project();

    const baselinePath = path.join(partial, ".planmap", "baseline.json");
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

    fs.writeFileSync(baselinePath, JSON.stringify({
        ...baseline,
        declarations: baseline.declarations.filter(
            declaration => declaration.identity !== SECONDARY)
    }, null, 2));

    const refused = runCli(["approve", partial, PRIMARY], partial, { apiKey: "" });

    assert.notEqual(refused.code, 0, "approving with a declaration missing must fail");
    assert.match(refused.stderr, new RegExp(SECONDARY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        "the refusal names the declaration that is missing");
}


// --------------------------------------------------
// UNCHANGED PASSES, THEN DRIFTS ON THE SECONDARY
// --------------------------------------------------

const clean = verifyPlan(root, {});

assert.deepEqual(clean.results[0].errors, [], `unexpected errors: ${JSON.stringify(clean.results[0].errors)}`);
assert.equal(
    clean.results[0].status,
    "implemented",
    "an unchanged rule on a secondary declaration passes against its own snapshot"
);

// Only readInvoices changes.
fs.writeFileSync(path.join(root, "store.js"), CHANGED);

const drifted = verifyPlan(root, {});
const result = drifted.results[0];

assert.equal(result.status, "drifted");
assert.equal(result.violations.length, 1, `expected one violation, got ${JSON.stringify(result.violations)}`);

assert.equal(
    result.violations[0].target,
    SECONDARY,
    "the violation names the declaration that actually changed"
);

assert.equal(result.violations[0].field, "calls");

assert.deepEqual(
    result.identities,
    [PRIMARY, SECONDARY],
    "the result carries every declaration it covers"
);


// --------------------------------------------------
// PROJECT EVOLUTION MARKS THE ROW THAT CHANGED
// --------------------------------------------------
// One drift in a step that stands for two functions must not paint both
// rows red. The reader is looking for the function that moved.

const evolution = JSON.parse(
    fs.readFileSync(path.join(root, ".planmap", "evolution.json"), "utf8"));

const updated = applyVerificationStatus(evolution, drifted.results);

const rowFor = identity => updated.nodes.find(candidate => candidate.identity === identity);

assert.equal(rowFor(SECONDARY).status, "drifted", "the declaration that changed is marked drifted");
assert.equal(rowFor(PRIMARY).status, "implemented", "the declaration that did not change is not");

assert.equal(rowFor(PRIMARY).statusSource, "verified");
assert.equal(rowFor(SECONDARY).statusSource, "verified");

console.log("PASS: summary-approve-verify");
