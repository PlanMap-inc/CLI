// ---------------------------------------------------------------------------
// after.js — the AFTER state for v0.2 property diff testing.
//
// Pair with before.js. Every change here is the kind an AI agent makes:
// it compiles, it runs, and it quietly does something different.
// ---------------------------------------------------------------------------

const db = require('../db');
const { compareHash } = require('../crypto');

// CHANGED: throws 2 -> 0, returnsNullish 0 -> 2, throwTypes [ValidationError] -> []
function validateScore(raw) {
  const n = Number(raw);

  if (Number.isNaN(n)) {
    return null;
  }

  if (n < 1 || n > 5) {
    return null;
  }

  return n;
}

// CHANGED: numbers [5, 3600] -> [500, 3600]
function rateLimit(email) {
  const maxPerWindow = 500;
  const windowSeconds = 3600;

  return db.attempts.count(email, windowSeconds) < maxPerWindow;
}

// CHANGED: awaits 2 -> 1, calls loses hashPassword
async function saveUser(email, password) {
  return await db.users.insert({ email, password });
}

// CHANGED: params 1 -> 2
function getSession(token, options) {
  return db.sessions.findOne({ token, ...options });
}

// CHANGED: catches 1 -> 2, emptyCatches 0 -> 1
async function cleanup(surveyId) {
  try {
    await db.responses.deleteMany({ surveyId });
  } catch (e) {
    logger.error('cleanup failed', e);
  }

  try {
    await db.surveys.delete(surveyId);
  } catch (e) {
    // swallowed
  }
}

// CONTROL — must produce ZERO differences.
// Reformatted, comment added, local variable renamed. Behaviour identical.
function parseBody(req) {
    // pull the raw payload off the request
    const payload = req.body;

    if (!payload) {
        return null;
    }

    const result = JSON.parse(payload);

    return result;
}

// legacyExport was here. It is gone. The diff must report it as DELETED.

// ADDED — does not exist in before.js
function healthCheck() {
  return { ok: true };
}

// CONTROL — untouched
function normalizeEmail(raw) {
  return String(raw).trim().toLowerCase();
}
