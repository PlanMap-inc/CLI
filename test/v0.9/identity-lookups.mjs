import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scanProject } from "../../src/baseline/scanner.js";
import { selectNodes } from "../../src/plan/approval.js";
import { nodeIdentities } from "../../src/plan/nodes.js";
import { runCli } from "../helpers/run-cli.mjs";

// --------------------------------------------------
// A MERGED NODE IS FOUND BY ANY OF ITS DECLARATIONS
// --------------------------------------------------
// Every lookup by declaration used to read node.identity, which is only
// the FIRST of them. That has two consequences, and both are here:
//
//   - the next draft does not see the others as settled, sends them to the
//     model again, and writes a second node for code a person already
//     ruled on. The plan then holds the same declaration twice.
//   - approve and revise report "Plan node not found" for a declaration
//     the plan does hold, because it is not the one the node is named
//     after.
// --------------------------------------------------

const PRIMARY = "src/store.js::readOrders:function";
const SECONDARY = "src/store.js::readInvoices:function";

const SOURCE = `export function readOrders() {
    return 1;
}

export function readInvoices() {
    return 1;
}
`;

const approvedSummary = {
    id: "plan_0001",
    feature: "f1",
    identity: PRIMARY,
    identities: [PRIMARY, SECONDARY],
    merge: "summary",
    role: "behaviour",
    title: "Read the stored records",
    intent: "Orders and invoices are read the same way",
    step: 1,
    summaryOf: [
        { identities: [PRIMARY], title: "Read the order rows" },
        { identities: [SECONDARY], title: "Read the invoice rows" }
    ],
    rules: [],
    status: "approved",
    approvedBy: "sam",
    approvedAt: "2026-09-10T00:00:00.000Z",
    lensTags: [],
    edgesOut: []
};


// --------------------------------------------------
// selectNodes FINDS IT BY EITHER DECLARATION, AND BY ITS ID
// --------------------------------------------------

const plan = {
    version: 1,
    lenses: [],
    features: [{ id: "f1", name: "Store" }],
    nodes: [approvedSummary]
};

for (const target of [PRIMARY, SECONDARY, "plan_0001"]) {
    const selection = selectNodes(plan, { identity: target });

    assert.deepEqual(selection.errors, [], `${target}: ${selection.errors.join("; ")}`);
    assert.equal(selection.matched.length, 1, `${target} must find the node`);
    assert.equal(selection.matched[0].id, "plan_0001");
}

assert.equal(
    selectNodes(plan, { identity: "src/store.js::nothing:function" }).matched.length,
    0,
    "widening the match must not make it match anything at all"
);


// --------------------------------------------------
// A PROJECT WITH THE SAME MERGED NODE, APPROVED
// --------------------------------------------------

function project(node = approvedSummary) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-lookup-"));

    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.join(root, ".planmap"));
    fs.writeFileSync(path.join(root, "src", "store.js"), SOURCE);

    const write = (name, value) =>
        fs.writeFileSync(path.join(root, ".planmap", name), JSON.stringify(value, null, 2));

    write("baseline.json", { version: 2, declarations: scanProject(root, { quiet: true }) });

    write("plan.json", {
        version: 1,
        lenses: [],
        features: [{ id: "f1", name: "Store" }],
        nodes: [node]
    });

    write("evolution.json", {
        version: 1,
        nodes: [PRIMARY, SECONDARY].map((identity, at) => ({
            id: `evo_000${at + 1}`,
            ts: "2026-09-05T00:00:00.000Z",
            type: "added",
            identity,
            labelSource: "llm",
            feature: "Store"
        }))
    });

    return root;
}

const readPlanFile = root =>
    JSON.parse(fs.readFileSync(path.join(root, ".planmap", "plan.json"), "utf8"));


// --------------------------------------------------
// REVISE BY THE SECONDARY DECLARATION
// --------------------------------------------------

{
    const root = project();

    const result = runCli(["plan", "revise", root, SECONDARY], root, { apiKey: "" });

    assert.equal(result.code, 0, `revise by a secondary declaration failed: ${result.stderr}`);
    assert.equal(readPlanFile(root).nodes[0].status, "intended");
}


// --------------------------------------------------
// APPROVE BY THE SECONDARY DECLARATION
// --------------------------------------------------

{
    const root = project({ ...approvedSummary, status: "intended" });

    const result = runCli(["approve", root, SECONDARY], root, { apiKey: "" });

    assert.equal(result.code, 0, `approve by a secondary declaration failed: ${result.stderr}`);

    const node = readPlanFile(root).nodes[0];

    assert.equal(node.status, "approved");
    assert.deepEqual(
        Object.keys(node.approvedFactsByIdentity).sort(),
        [PRIMARY, SECONDARY].sort()
    );
}


// --------------------------------------------------
// RE-DRAFTING MAKES NO DUPLICATE
// --------------------------------------------------
// The model is handed both declarations and answers with a node for each.
// Both are settled - they belong to an approved node - so the draft must
// send neither, and write neither.

{
    const root = project();

    const response = JSON.stringify({
        nodes: [PRIMARY, SECONDARY].map((identity, at) => ({
            identity,
            feature: "Store",
            role: "behaviour",
            step: at + 1,
            title: `Record the row ${at + 1} entry`,
            intent: `Row ${at + 1} is written once`,
            lensTags: [],
            rules: [
                { kind: "behaviour", target: identity, assert: { returns: { op: ">=", value: 1 } } }
            ]
        }))
    });

    const drafted = runCli(
        ["plan", "draft", root],
        root,
        { apiKey: "test-key", response, mock: true }
    );

    assert.equal(drafted.code, 0, `draft failed:\n${drafted.stdout}\n${drafted.stderr}`);

    const after = readPlanFile(root);
    const held = after.nodes.flatMap(nodeIdentities);

    assert.equal(
        new Set(held).size,
        held.length,
        `a declaration was drafted a second time: ${held.join(", ")}`
    );

    assert.deepEqual(
        after.nodes.map(node => node.id),
        ["plan_0001"],
        "both declarations were settled, so the draft must add nothing"
    );

    assert.equal(after.nodes[0].status, "approved", "the approved node is left as it was");
}


// --------------------------------------------------
// ONE OF THE TWO STILL OPEN
// --------------------------------------------------
// The guard is about what is settled, not about merging in general: an
// unsettled node whose second declaration turns up in a batch is the node
// that batch is redrawing, and it has to give way.
//
// The declaration the model did not answer for goes back into the pool
// and is reported, which is what a batch has always done with one it
// dropped. What must not happen is two nodes claiming the same one.

{
    const root = project({
        ...approvedSummary,
        status: "intended",
        origin: "ai_drafted",
        approvedBy: undefined,
        approvedAt: undefined
    });

    const response = JSON.stringify({
        nodes: [
            {
                identity: SECONDARY,
                feature: "Store",
                role: "behaviour",
                step: 1,
                title: "Read the stored invoice rows",
                intent: "Invoices are read once",
                lensTags: [],
                rules: [
                    { kind: "behaviour", target: SECONDARY, assert: { returns: { op: ">=", value: 1 } } }
                ]
            }
        ]
    });

    const drafted = runCli(
        ["plan", "draft", root],
        root,
        { apiKey: "test-key", response, mock: true }
    );

    assert.equal(drafted.code, 0, `draft failed:\n${drafted.stdout}\n${drafted.stderr}`);

    const held = readPlanFile(root).nodes.flatMap(nodeIdentities);

    assert.equal(
        held.filter(identity => identity === SECONDARY).length,
        1,
        `the secondary declaration must appear exactly once: ${held.join(", ")}`
    );

    assert.match(
        drafted.stdout,
        /the rest are retried on the next run/,
        "the declaration the model skipped is reported, not silently lost"
    );
}

console.log("PASS: identity-lookups");
