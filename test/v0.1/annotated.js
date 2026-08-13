// ---------------------------------------------------------------------------
// annotated.js — fixture for rung 2 (@intent anchoring).
// Every annotation below has a correct answer. Some are traps.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

// @intent: reject any email that is not lowercase and trimmed
function normalizeEmail(raw) {
  return String(raw).trim().toLowerCase();
}

// @intent: never return a session that has already expired
const loadSession = async (db, token) => {
  const row = await db.sessions.findOne({ token });
  if (!row || row.expiresAt < Date.now()) return null;
  return row;
};

// @intent: this handler must always respond, never throw
// @intent: 404 on missing survey, never 500
export function getSurvey(req, res) {
  const survey = req.db.surveys.get(req.params.id);
  if (!survey) return res.status(404).json({ error: 'not found' });
  return res.json(survey);
}

const MAX_ATTEMPTS = 5;

// @intent: retry only on network errors, never on validation errors
const RETRY_DELAY_MS = 250;
const BACKOFF_FACTOR = 2;

function withRetry(fn) {
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    try {
      return fn();
    } catch (e) {
      if (e.name === 'ValidationError') throw e;
    }
  }
  return null;
}

/* @intent: tokens must be cryptographically random, never Math.random */
function issueToken() {
  return crypto.randomBytes(32).toString('hex');
}

class SessionStore {
  constructor(db) {
    this.db = db;
  }

  // @intent: must be idempotent — calling twice is not an error
  revoke(token) {
    this.db.sessions.delete(token);
  }

  // @intent: this name is computed, so it cannot be an anchor
  ['dynamic' + 'Purge'](before) {
    this.db.sessions.deleteMany({ createdAt: { $lt: before } });
  }

  countActive() {
    return this.db.sessions.count({ expiresAt: { $gt: Date.now() } });
  }
}

function buildValidator(rules) {
  // @intent: an empty value is invalid, but zero and false are valid
  function checkRequired(value) {
    return value !== undefined && value !== null;
  }

  return checkRequired;
}

// TODO: add an @intent: annotation to the function below at some point
function undocumented(x) {
  return x;
}

export const healthCheck = (req, res) => res.json({ ok: true });

// @intent: this annotation has nothing after it
