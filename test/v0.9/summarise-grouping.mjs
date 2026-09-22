import assert from "node:assert/strict";

import {
    FEATURE_STEP_CAP,
    MAX_SUMMARY_SIZE,
    summariseFeatures
} from "../../src/plan/summarise.js";

import { validatePlan } from "../../src/plan/model.js";
import { nodeIdentities } from "../../src/plan/nodes.js";

// --------------------------------------------------
// A FEATURE HOLDS TWENTY STEPS, AND LOSES NOTHING
// --------------------------------------------------
// The grouping is the whole safety of the cap. A feature that draws 111
// cards is unreadable, but a feature that quietly drops 91 of them is
// worse: the plan would then claim the code does less than it does, and
// verify would stop checking the part that went missing.
//
// So every test here is about what SURVIVES the fold, not only about the
// count coming down.
// --------------------------------------------------

const HEADINGS = ["Read", "Shape", "Write"];

const named = index => `step${String(index).padStart(2, "0")}`;
const identityOf = index => `src/store.js::${named(index)}:function`;

function drafted(index, extra = {}) {
    return {
        id: `plan_${String(index).padStart(4, "0")}`,
        feature: "f1",
        identity: identityOf(index),
        role: "behaviour",
        title: `Record the ${named(index)} entry`,
        intent: `A ${named(index)} entry is written once`,
        step: index,
        path: [HEADINGS[index % 3]],
        lensTags: ["backend"],
        rules: [
            {
                kind: "behaviour",
                target: identityOf(index),
                assert: { returns: { op: ">=", value: 1 } }
            }
        ],
        status: "intended",
        origin: "ai_drafted",
        edgesOut: [],
        ...extra
    };
}

// buildCallGraph's shape, cut down to what the summariser reads.
function callGraphOf(edges) {
    const callers = new Map();

    for (const [from, to] of edges) {
        if (!callers.has(to)) callers.set(to, new Set());
        callers.get(to).add(from);
    }

    return { callers };
}

const planOf = (nodes, features = [{ id: "f1", name: "Data Store" }]) => ({
    version: 1,
    lenses: [],
    features,
    nodes
});


// --------------------------------------------------
// 45 IN, 20 OUT
// --------------------------------------------------

const many = Array.from({ length: 45 }, (_, at) => drafted(at + 1));

// step44 is only ever reached through step01, and they sit in different
// parts - so only the call-tree fold can put them together.
const graph = callGraphOf([
    [identityOf(1), identityOf(44)],
    [identityOf(2), identityOf(45)],
    [identityOf(45), identityOf(43)]
]);

const capped = summariseFeatures(planOf(many), { callGraph: graph });

const behaviours = capped.nodes.filter(node => node.role === "behaviour");

assert.equal(
    behaviours.length,
    FEATURE_STEP_CAP,
    `45 steps must come out as exactly ${FEATURE_STEP_CAP}, got ${behaviours.length}`
);

assert.deepEqual(validatePlan(planOf(capped.nodes)), [], "the capped plan must validate");


// --------------------------------------------------
// EVERY DECLARATION, EXACTLY ONCE
// --------------------------------------------------

const held = capped.nodes.flatMap(nodeIdentities);

assert.equal(
    new Set(held).size,
    held.length,
    "no declaration may end up on two nodes"
);

assert.deepEqual(
    [...held].sort(),
    many.map(node => node.identity).sort(),
    "every declaration that went in must come out, on exactly one node"
);


// --------------------------------------------------
// EVERY RULE, WITH ITS OWN TARGET
// --------------------------------------------------
// A summary step carries every member's rules unchanged. If a fold
// rewrote a target onto the lead, verify would check one declaration and
// report the whole group as proven.

const rulesOut = capped.nodes.flatMap(node => node.rules ?? []);

assert.deepEqual(
    rulesOut.map(rule => rule.target).sort(),
    many.flatMap(node => node.rules.map(rule => rule.target)).sort(),
    "every rule keeps its own target"
);

for (const node of capped.nodes) {
    for (const rule of node.rules ?? []) {
        assert.ok(
            nodeIdentities(node).includes(rule.target),
            `${node.id} holds a rule targeting ${rule.target}, which it does not stand for`
        );
    }
}


// --------------------------------------------------
// THE ORDER THE NODES ARRIVED IN CHANGES NOTHING
// --------------------------------------------------
// Compared by id, because the output keeps the input's relative order for
// everything it did not touch. What must not move is the grouping itself:
// the same nodes, the same ids, the same members.

function shuffled(list, seed) {
    const out = [...list];
    let state = seed;

    for (let at = out.length - 1; at > 0; at -= 1) {
        state = (state * 1103515245 + 12345) % 2147483648;
        const swap = state % (at + 1);
        [out[at], out[swap]] = [out[swap], out[at]];
    }

    return out;
}

const canonical = result =>
    JSON.stringify([...result.nodes].sort((a, b) => a.id.localeCompare(b.id)));

for (const seed of [7, 1234, 99999]) {
    assert.equal(
        canonical(summariseFeatures(planOf(shuffled(many, seed)), { callGraph: graph })),
        canonical(capped),
        `shuffling the nodes (seed ${seed}) must not change the grouping`
    );
}


// --------------------------------------------------
// WHAT IS NEVER TOUCHED
// --------------------------------------------------
// A person's decision, and anything that is not a step.

const untouchable = [
    drafted(101, { id: "plan_0101", status: "approved", approvedBy: "sam" }),
    drafted(102, { id: "plan_0102", origin: "human_authored" }),
    drafted(103, { id: "plan_0103", origin: "ai_edited_by_human" }),
    drafted(104, { id: "plan_0104", history: [{ id: "plan_0099", version: 1 }] }),
    drafted(105, { id: "plan_0105", role: "vocabulary" }),
    drafted(106, { id: "plan_0106", role: "machinery" }),
    drafted(107, { id: "plan_0107", role: "tool" })
];

const mixed = summariseFeatures(
    planOf([...many, ...untouchable]),
    { callGraph: graph }
);

for (const node of untouchable) {
    assert.ok(
        mixed.nodes.includes(node),
        `${node.id} (${node.status}/${node.origin}/${node.role}) must come out untouched`
    );
}

// Terms, preconditions and helpers are not steps and do not eat the cap.
assert.equal(
    mixed.nodes.filter(node => node.role === "behaviour").length,
    FEATURE_STEP_CAP,
    "only behaviour steps count against the cap"
);


// --------------------------------------------------
// A CALLEE GOES TO ITS CALLER FIRST
// --------------------------------------------------
// Before any same-part merge, because a call is something the code shows
// and a shared heading is only something the outline decided.

const groupHolding = (nodes, identity) =>
    nodes.find(node => nodeIdentities(node).includes(identity));

const withCaller = groupHolding(capped.nodes, identityOf(44));

assert.ok(
    nodeIdentities(withCaller).includes(identityOf(1)),
    "step44, whose only caller is step01, must end up on step01's node"
);

assert.notEqual(
    HEADINGS[44 % 3],
    HEADINGS[1 % 3],
    "the fixture only proves anything if the two sit in different parts"
);

// A chain: step02 -> step45 -> step43 all land together.
const chain = groupHolding(capped.nodes, identityOf(43));

assert.ok(
    nodeIdentities(chain).includes(identityOf(45)) &&
    nodeIdentities(chain).includes(identityOf(2)),
    "a chain of single callers folds the whole way up"
);


// --------------------------------------------------
// THE BUDGET
// --------------------------------------------------
// A settled step cannot be folded, so it spends the feature's budget.

const settled = count =>
    Array.from({ length: count }, (_, at) =>
        drafted(200 + at, { id: `plan_0${200 + at}`, status: "approved", approvedBy: "sam" }));

const open = (count, from = 400) =>
    Array.from({ length: count }, (_, at) => drafted(from + at, { id: `plan_0${from + at}` }));

const roomy = summariseFeatures(planOf([...settled(18), ...open(10)]));

assert.equal(
    roomy.nodes.filter(node => node.role === "behaviour").length,
    20,
    "18 settled and 10 open must come out as 20 steps"
);

assert.equal(roomy.report[0].after, 20);
assert.equal(roomy.report[0].overflow, 0);

const overfull = summariseFeatures(planOf([...settled(25), ...open(5)]));

const overfullSteps = overfull.nodes.filter(node => node.role === "behaviour");

assert.equal(
    overfullSteps.length,
    26,
    "25 settled steps cannot be folded, so the 5 open ones become exactly 1"
);

assert.equal(
    overfullSteps.filter(node => node.merge === "summary").length,
    1,
    "the open steps fold as tightly as the grouping allows: one summary step"
);

assert.equal(
    overfull.report[0].overflow,
    6,
    "the overflow the settled steps cause is reported, not hidden"
);

assert.match(
    overfull.report[0].line,
    /over the cap/,
    "the reported line says the feature is still over the cap"
);


// --------------------------------------------------
// A FEATURE THAT ALREADY FITS IS LEFT ALONE
// --------------------------------------------------

const small = open(12, 700);
const untouched = summariseFeatures(planOf(small));

assert.deepEqual(untouched.nodes, small);
assert.deepEqual(untouched.summaries, []);
assert.deepEqual(untouched.report, []);


// --------------------------------------------------
// NEVER ACROSS FEATURES
// --------------------------------------------------

const twoFeatures = [
    ...many,
    ...many.map((node, at) => ({
        ...node,
        id: `plan_1${String(at + 1).padStart(3, "0")}`,
        feature: "f2"
    }))
];

const split = summariseFeatures(
    planOf(twoFeatures, [
        { id: "f1", name: "Data Store" },
        { id: "f2", name: "Reports" }
    ]),
    { callGraph: graph }
);

for (const node of split.nodes) {
    assert.ok(
        node.feature === "f1" || node.feature === "f2",
        "a summary step belongs to one feature"
    );
}

assert.equal(split.nodes.filter(node => node.feature === "f1").length, FEATURE_STEP_CAP);
assert.equal(split.nodes.filter(node => node.feature === "f2").length, FEATURE_STEP_CAP);

assert.deepEqual(
    split.report.map(entry => entry.name).sort(),
    ["Data Store", "Reports"],
    "each capped feature is reported by name"
);


// --------------------------------------------------
// WHAT A SUMMARY STEP LOOKS LIKE
// --------------------------------------------------

const summary = capped.nodes.find(node => node.merge === "summary");

assert.ok(summary, "45 steps must produce at least one summary step");
assert.equal(summary.role, "behaviour");
assert.equal(summary.status, "intended");
assert.equal(summary.origin, "ai_drafted");
assert.equal(summary.identity, summary.identities[0]);
assert.ok(summary.identities.length > 1);
assert.equal(summary.readings, undefined, "a summary step invents no lens readings");
assert.equal(summary.dimensions, undefined, "a summary step is not a family merge");
assert.ok(summary.title && summary.intent, "a summary step always has a fallback title");

assert.deepEqual(
    summary.summaryOf.flatMap(entry => entry.identities).sort(),
    [...summary.identities].sort(),
    "summaryOf accounts for every declaration the step stands for"
);

for (const entry of summary.summaryOf) {
    assert.ok(entry.title, "every covered step keeps its own title");
}

// --------------------------------------------------
// NO SUMMARY STEP COVERS MORE THAN TWELVE
// --------------------------------------------------
// The cap keeps a feature readable; this keeps a card reviewable. Where
// the two conflict the cap gives way, because a feature over twenty that
// says so is honest, and one card standing for 136 steps is not.

const coversOf = node =>
    Array.isArray(node.summaryOf) ? node.summaryOf.length : 1;

for (const result of [capped, mixed, split, overfull, roomy]) {
    for (const node of result.nodes.filter(node => node.merge === "summary")) {
        assert.ok(
            coversOf(node) <= MAX_SUMMARY_SIZE,
            `${node.id} covers ${coversOf(node)} steps, over the limit of ${MAX_SUMMARY_SIZE}`
        );
    }
}


// --------------------------------------------------
// THE EXPRESS CASE: 25 SETTLED, 136 ELIGIBLE
// --------------------------------------------------
// Budget 1. Before the limit this produced one card covering 136 steps.

{
    const many = Array.from({ length: 136 }, (_, at) =>
        drafted(500 + at, { id: `plan_${String(500 + at).padStart(4, "0")}` }));

    const result = summariseFeatures(planOf([...settled(25), ...many]));

    const summaries = result.nodes.filter(node => node.merge === "summary");

    for (const node of summaries) {
        assert.ok(
            coversOf(node) <= MAX_SUMMARY_SIZE,
            `${node.id} covers ${coversOf(node)} steps`
        );
    }

    // Nothing is lost to the limit.
    const held = result.nodes.flatMap(nodeIdentities);

    assert.equal(new Set(held).size, held.length, "no declaration appears twice");

    assert.deepEqual(
        [...held].sort(),
        [...settled(25), ...many].map(node => node.identity).sort(),
        "every declaration survives a fold that had to stop early"
    );

    // The feature stays over the cap, and says why.
    const entry = result.report[0];

    assert.ok(entry.overflow > 0, "the feature is still over the cap");
    assert.equal(entry.limited, true, "and the summary limit is what stopped it");

    assert.match(
        entry.line,
        /still \d+ over the cap of 20: 25 settled steps, and no summary step may cover more than 12/,
        `the line must name both reasons:\n${entry.line}`
    );

    assert.deepEqual(validatePlan(planOf(result.nodes)), [], "the plan still validates");
}


// --------------------------------------------------
// AN ORDINARY FEATURE IS UNAFFECTED
// --------------------------------------------------
// 45 steps and a full budget still land on exactly 20, because nothing
// there needs a group of more than twelve.

assert.equal(behaviours.length, FEATURE_STEP_CAP);

assert.ok(
    behaviours.every(node => coversOf(node) <= MAX_SUMMARY_SIZE),
    "no group in a normal feature comes near the limit"
);


// --------------------------------------------------
// A NODE WITH NO ROLE IS A STEP
// --------------------------------------------------
// DEFAULT_ROLE says so, the webview draws it so, and the draft falls back
// to it - but the cap used to need the field present, so a step added
// with `plan add` never counted, and a plan drafted before roles existed
// was never folded at all.

{
    const roleless = Array.from({ length: 30 }, (_, at) => {
        const node = drafted(800 + at, { id: `plan_${String(800 + at).padStart(4, "0")}` });
        delete node.role;
        return node;
    });

    const result = summariseFeatures(planOf(roleless));

    assert.equal(
        result.nodes.length,
        FEATURE_STEP_CAP,
        "role-less intended steps are folded like any other"
    );

    assert.ok(result.summaries.length > 0);
}

{
    // Role-less and approved: settled, so it is never folded and it still
    // spends the feature's budget.
    const settledRoleless = Array.from({ length: 18 }, (_, at) => {
        const node = drafted(900 + at, {
            id: `plan_${String(900 + at).padStart(4, "0")}`,
            status: "approved",
            approvedBy: "sam"
        });
        delete node.role;
        return node;
    });

    const openTen = open(10, 950);

    const result = summariseFeatures(planOf([...settledRoleless, ...openTen]));

    for (const node of settledRoleless) {
        assert.ok(result.nodes.includes(node), `${node.id} must come out untouched`);
    }

    assert.equal(
        result.nodes.length,
        20,
        "18 role-less settled steps plus 10 open ones come out at the cap"
    );
}

console.log("PASS: summarise-grouping");
