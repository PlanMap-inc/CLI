import assert from "node:assert/strict";

import {
    coversBlocks,
    coveredStepTitle,
    describeViolation,
    detailLine,
    effectiveStatus,
    isSummary,
    nodeSub
} from "../webview/model.js";

// --------------------------------------------------
// A SUMMARY STEP, READ BY A PERSON
// --------------------------------------------------
// The folding is only worth doing if the card stays honest about it. Three
// things have to hold:
//
//   - the card says how many steps are behind it, not how many functions
//   - the panel lists those steps, each with its own code, its own rules
//     and its own evidence - not one flat run of identities
//   - a drift names the step it happened in, because "calls changed" on a
//     card that stands for seven steps tells the reader nothing
// --------------------------------------------------

const ORDERS = "src/store.js::readOrders:function";
const INVOICES = "src/store.js::readInvoices:function";
const LEDGER = "src/store.js::readLedger:function";

const summary = {
    id: "plan_0031",
    feature: "f1",
    identity: ORDERS,
    identities: [ORDERS, INVOICES, LEDGER],
    merge: "summary",
    role: "behaviour",
    title: "Read the stored records in order",
    intent: "Orders, invoices and the ledger are read the same way.",
    summaryOf: [
        { identities: [ORDERS], title: "Read the order rows" },
        { identities: [INVOICES, LEDGER], title: "Read the invoice and ledger rows" }
    ],
    rules: [
        { kind: "behaviour", target: ORDERS, assert: { returns: { op: ">=", value: 1 } } },
        { kind: "behaviour", target: INVOICES, assert: { calls: { op: "unchanged" } } },
        { kind: "behaviour", target: LEDGER, assert: { throws: { op: "==", value: 1 } } }
    ],
    status: "intended",
    origin: "ai_drafted",
    edgesOut: []
};

const facts = {
    [ORDERS]: {
        throws: 0, throwTypes: [], returns: 1, returnsNullish: 0,
        calls: ["fetchRows"], numbers: [], awaits: 0, catches: 0, emptyCatches: 0, params: 0
    },
    [INVOICES]: {
        throws: 0, throwTypes: [], returns: 1, returnsNullish: 0,
        calls: ["fetchRows"], numbers: [], awaits: 0, catches: 0, emptyCatches: 0, params: 0
    },
    [LEDGER]: {
        throws: 1, throwTypes: ["Error"], returns: 0, returnsNullish: 0,
        calls: [], numbers: [], awaits: 0, catches: 0, emptyCatches: 0, params: 0
    }
};


// --------------------------------------------------
// THE CARD'S DETAIL LINE
// --------------------------------------------------
// Steps, not declarations. This step holds three functions but covers two
// steps, and two is the number a reader can act on.

assert.equal(isSummary(summary), true);

// The CODE line reads like any other node standing for several
// declarations: it says where to go and check, which is what that line is
// for on every card. How much is behind the card is a different question,
// and it is answered on the detail line below.
assert.equal(nodeSub(summary), "3 declarations · store.js");

assert.deepEqual(
    detailLine(summary),
    { kind: "covers", text: "covers 2 steps" },
    "the detail line says how many steps are behind the card"
);

assert.equal(
    detailLine({ ...summary, summaryOf: [summary.summaryOf[0]] }).text,
    "covers 1 step",
    "one covered step reads as one step, not '1 steps'"
);

// --------------------------------------------------
// THE DETAIL LINE, IN ORDER
// --------------------------------------------------
// A lens reading wins, then a summary's count, then the nouns a family
// merge reads across, then a fact from the code.

const withReading = { ...summary, readings: { security: "Refuse a read the caller may not make" } };

assert.deepEqual(
    detailLine(withReading, { lensId: "security" }),
    { kind: "reading", lens: "security", text: "Refuse a read the caller may not make" },
    "a lens reading outranks the covers line"
);

assert.equal(
    detailLine(withReading, { lensId: "backend" }).kind,
    "covers",
    "a lens with nothing to say here falls through"
);

assert.equal(detailLine(withReading).kind, "covers", "and so does no lens at all");

assert.deepEqual(
    detailLine({ identity: ORDERS, identities: [ORDERS, INVOICES], dimensions: ["order", "invoice"] }),
    { kind: "dimensions", text: "across order · invoice" },
    "a family merge names what it reads across"
);

assert.deepEqual(
    detailLine({ identity: ORDERS }, { facts }),
    { kind: "evidence", text: "calls fetchRows" },
    "otherwise, one fact from the code"
);

assert.equal(detailLine({ identity: ORDERS }), null, "and nothing when there is nothing true to say");

// An ordinary node, and a family merge, are untouched.
assert.equal(
    nodeSub({ identity: "src/api.py::get_agencies:function" }),
    "get_agencies() · api.py"
);

assert.equal(
    nodeSub({
        identity: ORDERS,
        identities: [ORDERS, INVOICES],
        dimensions: ["order", "invoice"]
    }),
    "2 declarations · store.js",
    "a family merge still counts declarations - it stands for one step, not several"
);

assert.equal(isSummary({ identity: ORDERS }), false);
assert.equal(
    isSummary({ merge: "summary", summaryOf: [] }),
    false,
    "a summary that covers nothing is not a summary"
);


// --------------------------------------------------
// THIS STEP COVERS
// --------------------------------------------------

const blocks = coversBlocks(summary, facts);

assert.equal(blocks.length, 2, "one block per covered step, in the order they were folded");

assert.equal(blocks[0].title, "Read the order rows");
assert.deepEqual(blocks[0].names, ["readOrders"]);
assert.deepEqual(blocks[0].rules.map(rule => rule.target), [ORDERS]);
assert.deepEqual(blocks[0].rules[0].clauses, ["returns >= 1"]);
assert.deepEqual(blocks[0].evidence, ["calls fetchRows"]);

assert.equal(blocks[1].title, "Read the invoice and ledger rows");
assert.deepEqual(
    blocks[1].names,
    ["readInvoices", "readLedger"],
    "a covered step that itself stands for two functions names both"
);

assert.deepEqual(
    blocks[1].rules.map(rule => rule.target),
    [INVOICES, LEDGER],
    "a covered step shows the rules whose target is one of ITS declarations"
);

assert.ok(
    blocks[1].evidence.length > 0,
    "a covered step shows its own evidence lines"
);

// Every rule on the node lands on exactly one covered step: nothing is
// shown twice, and nothing goes missing behind the card.
assert.deepEqual(
    blocks.flatMap(block => block.rules.map(rule => rule.target)).sort(),
    summary.rules.map(rule => rule.target).sort()
);

// With no facts loaded yet, the blocks still render - just without
// evidence. Nothing is invented.
const bare = coversBlocks(summary, {});

assert.equal(bare.length, 2);
assert.deepEqual(bare.flatMap(block => block.evidence), []);

assert.deepEqual(coversBlocks({ identity: ORDERS }, facts), [], "an ordinary node covers nothing");


// --------------------------------------------------
// WHY IT DRIFTED, BY COVERED STEP
// --------------------------------------------------

assert.equal(coveredStepTitle(summary, INVOICES), "Read the invoice and ledger rows");
assert.equal(coveredStepTitle(summary, ORDERS), "Read the order rows");
assert.equal(coveredStepTitle(summary, "src/store.js::somethingElse:function"), null);
assert.equal(coveredStepTitle({ identity: ORDERS }, ORDERS), null);

const violation = {
    target: INVOICES,
    field: "calls",
    expected: ["fetchRows"],
    actual: ["fetchRows", "audit"],
    reason: "calls changed since approval"
};

assert.equal(
    describeViolation(violation, summary).covers,
    "Read the invoice and ledger rows",
    "a violation names the covered step it belongs to"
);

// An ordinary node's violation keeps exactly the shape it had: no key at
// all, rather than one that is always null.
assert.equal(
    "covers" in describeViolation(violation),
    false,
    "describeViolation without a node is unchanged"
);

assert.equal(
    "covers" in describeViolation(violation, { identity: ORDERS }),
    false,
    "a node with nothing to disambiguate adds nothing"
);

// --------------------------------------------------
// A DRIFT IN ANY COVERED STEP REDDENS THE CARD
// --------------------------------------------------
// Each declaration now carries a verified status of its own, so the one
// that did not change stays implemented. The card has to read all of them
// or it would go green over drifted code.

const approved = { ...summary, status: "approved", version: 1 };

const rowsFor = statuses =>
    Object.fromEntries(Object.entries(statuses).map(([identity, status]) => [
        identity,
        { status, verifiedAgainst: `${approved.id}@1` }
    ]));

assert.equal(
    effectiveStatus(approved, rowsFor({
        [ORDERS]: "implemented",
        [INVOICES]: "drifted",
        [LEDGER]: "implemented"
    })),
    "drifted",
    "a drift in a covered step that is not the first must still show"
);

assert.equal(
    effectiveStatus(approved, rowsFor({
        [ORDERS]: "drifted",
        [INVOICES]: "error",
        [LEDGER]: "implemented"
    })),
    "error",
    "an error outranks a drift, as it does on the node itself"
);

assert.equal(
    effectiveStatus(approved, rowsFor({
        [ORDERS]: "implemented",
        [INVOICES]: "implemented",
        [LEDGER]: "implemented"
    })),
    "implemented"
);

// An ordinary node is unchanged, including the version guard: a result
// measured against an older version of the node no longer applies.
const single = { id: "plan_0002", identity: ORDERS, status: "approved", version: 2 };

assert.equal(
    effectiveStatus(single, { [ORDERS]: { status: "drifted", verifiedAgainst: "plan_0002@2" } }),
    "drifted"
);

assert.equal(
    effectiveStatus(single, { [ORDERS]: { status: "drifted", verifiedAgainst: "plan_0002@1" } }),
    "approved",
    "a result measured against an earlier version of the node is ignored"
);

assert.equal(effectiveStatus(single, {}), "approved");

console.log("PASS: summary-step");
