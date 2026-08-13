// ---------------------------------------------------------------------------
// before.js — the BEFORE state for v0.2 property diff testing.
//
// Pair with after.js. Eight declarations, eight deliberate differences.
// The expected delta for each is written above it.
// ---------------------------------------------------------------------------

const db = require('../db');
const { hashPassword, compareHash } = require('../crypto');

// EXPECTED: throws 2 -> 0, returnsNullish 0 -> 2, throwTypes [ValidationError] -> []
// This is the Phase 0 case. Error handling silently becomes a null return.
function validateScore(raw) {
  const n = Number(raw);

  if (Number.isNaN(n)) {
    throw new ValidationError('score must be numeric');
  }

  if (n < 1 || n > 5) {
    throw new ValidationError('score out of range');
  }

  return n;
}

// EXPECTED: numbers [5, 3600] -> [500, 3600]
// A rule quietly loosened by 100x.
function rateLimit(email) {
  const maxPerWindow = 5;
  const windowSeconds = 3600;

  return db.attempts.count(email, windowSeconds) < maxPerWindow;
}

// EXPECTED: awaits 2 -> 1, calls loses hashPassword
// Password hashing removed. Still compiles, still "works", stores plaintext.
async function saveUser(email, password) {
  const hashed = await hashPassword(password);

  return await db.users.insert({ email, password: hashed });
}

// EXPECTED: params 1 -> 2
// Signature drift. Every caller is now potentially wrong.
function getSession(token) {
  return db.sessions.findOne({ token });
}

// EXPECTED: catches 1 -> 2, emptyCatches 0 -> 1
// A new catch block that swallows the error without handling it.
async function cleanup(surveyId) {
  try {
    await db.responses.deleteMany({ surveyId });
  } catch (e) {
    logger.error('cleanup failed', e);
  }

  await db.surveys.delete(surveyId);
}

// EXPECTED: NO CHANGE AT ALL
// This is the control case and the most important test in v0.2.
// after.js reformats this, renames a local, and adds a comment.
// If any property differs, the whole approach has failed.
function parseBody(req) {
  const raw = req.body;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed;
}

// EXPECTED: DELETED — this declaration does not exist in after.js
// Tests that the diff walks both directions, not just forward.
function legacyExport(rows) {
  return rows.map((r) => r.id).join(',');
}

// EXPECTED: NO CHANGE
// A second control. Untouched between versions.
function normalizeEmail(raw) {
  return String(raw).trim().toLowerCase();
}
