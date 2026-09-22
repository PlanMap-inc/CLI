import assert from "node:assert/strict";

import { evidenceLines } from "../webview/model.js";

// --------------------------------------------------
// THE REAL AI_CODING_SURVEY verifyJWT DECLARATION
// --------------------------------------------------
// Exactly what /Users/sambhavjain/Desktop/DATA/Ai-Survey/AI_Coding_Survey's
// own .planmap/baseline.json records for
// Backend/src/middleware/auth.js::verifyJWT:function - a real, messy
// example rather than a tidied-up one.
// --------------------------------------------------

const verifyJWTFacts = {
    throws: 0, throwTypes: [], returns: 3, returnsNullish: 0,
    calls: ["authHeader.split", "jwt.verify", "next", "res.status"],
    numbers: [1, 401], awaits: 0, catches: 1, emptyCatches: 0, params: 3
};

const lines = evidenceLines(verifyJWTFacts);

assert.deepEqual(lines, [
    "calls authHeader.split",
    "answers 401",
    "catches an error",
    "calls jwt.verify",
    "calls next",
    "calls res.status"
]);

// The card shows the FIRST line only - see detailLine() - so what matters
// here is that the most telling fact comes first: one per category before
// falling back to the rest of the calls.
assert.equal(lines[0], "calls authHeader.split");

// --------------------------------------------------
// NO FACTS, NO LINES - NEVER INVENT ONE
// --------------------------------------------------

assert.deepEqual(evidenceLines(undefined), []);
assert.deepEqual(evidenceLines(null), []);
assert.deepEqual(evidenceLines({}), []);

// --------------------------------------------------
// A "data" DECLARATION - ENTRYCOUNT, NOT CALLS
// --------------------------------------------------

assert.deepEqual(evidenceLines({ entryCount: 12, entries: ["q1", "q2"] }), ["holds 12 entries"]);

// --------------------------------------------------
// PARAMS ONLY SURFACES WHEN NOTHING ELSE DOES
// --------------------------------------------------

assert.deepEqual(evidenceLines({ params: 2 }), ["takes 2 parameters"], "the least informative fact alone is still better than nothing");
assert.deepEqual(evidenceLines({ params: 2, calls: ["helper"] }), ["calls helper"], "params never crowds out a more concrete fact");

// --------------------------------------------------
// A NUMBER IN THE STATUS RANGE IS NOT A STATUS CODE ON ITS OWN
// --------------------------------------------------
// setTimeout(fn, 300), a 500ms debounce, a CSS width of 200: all in [100,599]
// and none of them an HTTP response. "answers N" needs a call that actually
// sends one, which is what makes verifyJWT's "answers 401" above honest -
// its calls include res.status.
// --------------------------------------------------

assert.deepEqual(evidenceLines({ numbers: [300] }), [], "a number in range with no calls at all says nothing about an HTTP response");
assert.deepEqual(evidenceLines({ numbers: [300], calls: ["setTimeout"] }), ["calls setTimeout"], "a 300ms timeout must not render as \"answers 300\"");
assert.deepEqual(evidenceLines({ numbers: [404], calls: ["res.sendStatus"] }), ["calls res.sendStatus", "answers 404"], "a status-sending call is the corroboration the line needs");

// --------------------------------------------------
// SINGULAR PHRASING
// --------------------------------------------------

assert.deepEqual(evidenceLines({ throws: 1, catches: 1, awaits: 1, params: 1 }), ["throws an error", "catches an error", "awaits one call"]);

// --------------------------------------------------
// A CALLBACK REGISTRATION READS AS "registers", NEVER "calls"
// --------------------------------------------------
// window.onload handing handleCredentialResponse to
// google.accounts.id.initialize({ callback: handleCredentialResponse })
// never invokes it - the card must say so honestly, not claim a call that
// doesn't happen.
// --------------------------------------------------

assert.deepEqual(evidenceLines({ callbacks: ["handleCredentialResponse"] }), ["registers handleCredentialResponse as a callback"]);
assert.deepEqual(evidenceLines({}), [], "no callbacks fact means no line, never invented");
assert.deepEqual(
    evidenceLines({ calls: ["jwt.verify"], callbacks: ["onSuccess", "onFailure"] }),
    ["calls jwt.verify", "registers onSuccess as a callback", "registers onFailure as a callback"],
    "calls and callbacks are reported separately, and every callback beyond the first still appears"
);

console.log("PASS: evidence-lines");
