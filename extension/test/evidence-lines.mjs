import assert from "node:assert/strict";

import { evidenceLines, CARD_EVIDENCE_LINES } from "../webview/model.js";

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

assert.deepEqual(lines.slice(0, CARD_EVIDENCE_LINES), ["calls authHeader.split", "answers 401"], "the card shows the first two - one per category before falling back to the rest of the calls");

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
// SINGULAR PHRASING
// --------------------------------------------------

assert.deepEqual(evidenceLines({ throws: 1, catches: 1, awaits: 1, params: 1 }), ["throws an error", "catches an error", "awaits one call"]);

console.log("PASS: evidence-lines");
