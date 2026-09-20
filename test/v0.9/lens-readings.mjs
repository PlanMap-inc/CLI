import assert from "node:assert/strict";

import { dropRepeatedReadings } from "../../src/plan/draft.js";

// --------------------------------------------------
// A LENS CAN BE SILENT - AN OMITTED KEY IS NOT A DEFECT
// --------------------------------------------------

const sparse = [
    { id: "plan_0001", identity: "a.js::a:function", title: "Reject a booking with no address",
      readings: { security: "Refuse a submission with a missing field" } }
];

dropRepeatedReadings(sparse, []);
assert.deepEqual(Object.keys(sparse[0].readings), ["security"], "frontend, backend and database had nothing of their own to say here, and that is a valid, honest answer");

// --------------------------------------------------
// MANUFACTURED FILLER IS DROPPED, NOT KEPT AS A HEDGE
// --------------------------------------------------
// These are the exact shapes the task calls out as banned: a lens forced to
// say SOMETHING when it has nothing produces a negated non-answer instead
// of an omission. Confirmed present in the real AI_Coding_Survey project's
// plan.json before this fix: hideAllSections got
// "security": "No checks happen here", and sections:data got
// "security": "No access checks apply".
// --------------------------------------------------

const filler = [
    {
        id: "plan_0002", identity: "b.js::b:function", title: "Hide all visible sections",
        readings: {
            frontend: "Fold the visible section out of view",
            backend: "No server call happens here",
            database: "No rows are read",
            security: "Nothing is checked here"
        }
    }
];

const dropped = [];
dropRepeatedReadings(filler, dropped);

assert.deepEqual(
    Object.keys(filler[0].readings),
    ["frontend"],
    "the one reading that actually says something distinct survives; the three negated non-answers are dropped"
);
assert.equal(dropped.length, 3);
assert.ok(dropped.every(line => /negative filler/.test(line)), "each drop is reported with a reason, the same way a placeholder-verb drop already is");

// --------------------------------------------------
// LEGITIMATE READINGS WITH "ANYONE" ARE NOT FALSE-POSITIVES
// --------------------------------------------------
// A grounded permission statement like "Anyone holding X may Y" is exactly
// the kind of specific security reading that should survive. It is not filler.
// --------------------------------------------------

const legitimate = [
    {
        id: "plan_0003", identity: "c.js::c:function", title: "Print the booking",
        readings: {
            security: "Anyone holding the booking may print it",
            database: "The address came with the booking"
        }
    }
];

const dropped2 = [];
dropRepeatedReadings(legitimate, dropped2);

assert.deepEqual(
    Object.keys(legitimate[0].readings),
    ["security", "database"],
    "grounded permission statements like 'Anyone holding...' survive unchanged"
);
assert.equal(dropped2.length, 0, "legitimate readings are never dropped, even if they contain 'Anyone'");

console.log("PASS: lens-readings");
