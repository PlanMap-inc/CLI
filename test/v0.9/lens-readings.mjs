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

console.log("PASS: lens-readings");
