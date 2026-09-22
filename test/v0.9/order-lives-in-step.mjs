import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { addPlanNode, reorderPlanNode } from "../../src/plan/authoring.js";

// --------------------------------------------------
// ORDER LIVES IN step; edgesOut ONLY MEANS CALLS
// --------------------------------------------------
// edgesOut used to mean two things at once. A draft writes it from the
// call graph - "this code calls that code" - and `plan order` overwrote
// it with a chain saying "this step comes before that one". After one
// reorder there was no way to tell the two apart, and the Plan Graph laid
// a feature out from whichever meaning it happened to be holding.
//
// So they are separated. Reordering renumbers `step` and never writes an
// edge; the call graph is the only thing that ever writes one.
// --------------------------------------------------

const CALLS = {
    plan_0001: ["plan_0003"],
    plan_0002: [],
    plan_0003: ["plan_0004", "plan_0009"],
    plan_0004: [],
    plan_0005: ["plan_0001"]
};

function project() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-order-"));

    fs.mkdirSync(path.join(root, ".planmap"));

    fs.writeFileSync(
        path.join(root, ".planmap", "plan.json"),
        JSON.stringify({
            version: 1,
            lenses: [],
            features: [
                { id: "f1", name: "Dispatch" },
                { id: "f2", name: "Reports" }
            ],
            nodes: [
                ...Object.entries(CALLS).map(([id, edgesOut], at) => ({
                    id,
                    feature: "f1",
                    identity: `src/a.js::step${at + 1}:function`,
                    role: "behaviour",
                    title: `Record the step ${at + 1} entry`,
                    intent: `Step ${at + 1} happens`,
                    step: at + 1,
                    lensTags: [],
                    rules: [],
                    edgesOut: [...edgesOut],
                    status: "intended",
                    origin: "ai_drafted"
                })),
                {
                    id: "plan_0009",
                    feature: "f2",
                    identity: "src/b.js::other:function",
                    role: "behaviour",
                    title: "Record the other entry",
                    intent: "Something else happens",
                    step: 1,
                    lensTags: [],
                    rules: [],
                    edgesOut: [],
                    status: "intended",
                    origin: "ai_drafted"
                }
            ]
        }, null, 2)
    );

    return root;
}

const read = root =>
    JSON.parse(fs.readFileSync(path.join(root, ".planmap", "plan.json"), "utf8"));

const edgesOf = plan =>
    Object.fromEntries(plan.nodes.map(node => [node.id, node.edgesOut]));

const orderOf = (plan, feature = "f1") =>
    plan.nodes
        .filter(node => node.feature === feature)
        .sort((left, right) => left.step - right.step)
        .map(node => node.id);


// --------------------------------------------------
// REORDERING LEAVES EVERY EDGE ALONE
// --------------------------------------------------

{
    const root = project();
    const before = edgesOf(read(root));

    reorderPlanNode(root, "plan_0004", { toStart: true });

    assert.deepEqual(
        edgesOf(read(root)),
        before,
        "a reorder must not touch a single call edge, in this feature or any other"
    );
}


// --------------------------------------------------
// --first AND --after LAND WHERE THEY SAY
// --------------------------------------------------

{
    const root = project();

    reorderPlanNode(root, "plan_0004", { toStart: true });

    assert.deepEqual(
        orderOf(read(root)),
        ["plan_0004", "plan_0001", "plan_0002", "plan_0003", "plan_0005"],
        "--first puts the step at the top of its feature"
    );

    reorderPlanNode(root, "plan_0001", { after: "plan_0003" });

    assert.deepEqual(
        orderOf(read(root)),
        ["plan_0004", "plan_0002", "plan_0003", "plan_0001", "plan_0005"],
        "--after puts the step straight after the one it names"
    );

    // By identity, as the command has always allowed.
    reorderPlanNode(root, "plan_0005", { after: "src/a.js::step2:function" });

    assert.deepEqual(
        orderOf(read(root)),
        ["plan_0004", "plan_0002", "plan_0005", "plan_0003", "plan_0001"],
        "--after accepts a declaration as well as an id"
    );

    assert.throws(
        () => reorderPlanNode(root, "plan_0001", { after: "plan_0009" }),
        /No step in f1 matches/,
        "a step in another feature is not a place to move to"
    );
}


// --------------------------------------------------
// THE NUMBERS STAY CONTIGUOUS
// --------------------------------------------------
// Every step in the feature is numbered 1..N after any change, so there
// is never a gap and never two steps sharing a number.

const contiguous = (plan, feature, what) => {
    const steps = plan.nodes
        .filter(node => node.feature === feature)
        .map(node => node.step)
        .sort((left, right) => left - right);

    assert.deepEqual(
        steps,
        Array.from({ length: steps.length }, (_, at) => at + 1),
        `${what}: steps must run 1..${steps.length}, got ${steps.join(", ")}`
    );
};

{
    const root = project();

    reorderPlanNode(root, "plan_0003", { toStart: true });
    contiguous(read(root), "f1", "after a reorder");

    addPlanNode(root, "Dispatch", "Seal the van before it leaves");
    contiguous(read(root), "f1", "after an add at the end");

    addPlanNode(root, "Dispatch", "Weigh the parcel", { after: "plan_0002" });
    contiguous(read(root), "f1", "after an add in the middle");

    // The other feature is never renumbered by either.
    assert.equal(
        read(root).nodes.find(node => node.id === "plan_0009").step,
        1,
        "another feature's numbering is left alone"
    );
}


// --------------------------------------------------
// ADDING PUTS THE STEP WHERE IT WAS ASKED FOR
// --------------------------------------------------

{
    const root = project();

    const added = addPlanNode(root, "Dispatch", "Weigh the parcel", { after: "plan_0002" });

    assert.deepEqual(
        orderOf(read(root)),
        ["plan_0001", "plan_0002", added.id, "plan_0003", "plan_0004", "plan_0005"],
        "an added step lands straight after the one it names"
    );

    const appended = addPlanNode(root, "Dispatch", "Seal the van before it leaves");

    assert.equal(
        orderOf(read(root)).at(-1),
        appended.id,
        "with no --after it goes to the end"
    );

    // And still no edge was written.
    const edges = edgesOf(read(root));

    assert.deepEqual(edges.plan_0001, CALLS.plan_0001);
    assert.deepEqual(edges.plan_0003, CALLS.plan_0003);
    assert.deepEqual(edges[added.id], [], "a new step calls nothing until code says so");
}

console.log("PASS: order-lives-in-step");
