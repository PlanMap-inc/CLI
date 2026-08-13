// ---------------------------------------------------------------------------
// cjs-router.js — CommonJS survey router.
// Exercises the module.exports / exports branch, which has never seen real CJS.
// ---------------------------------------------------------------------------

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');

const router = express.Router();

// --- plain declarations ----------------------------------------------------

function requireAuth(req, res, next) {
  if (!req.headers.authorization) return res.status(401).end();
  next();
}

const rateLimit = (windowMs) => (req, res, next) => {
  req.window = windowMs;
  next();
};

async function fetchSurvey(id) {
  const { rows } = await db.query('SELECT * FROM surveys WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// --- route registrations (call sites, not declarations) --------------------

router.get('/surveys', requireAuth, async (req, res) => {
  res.json(await db.query('SELECT id, title FROM surveys'));
});

router.post(
  '/surveys/:id/responses',
  requireAuth,
  body('score').isInt({ min: 1, max: 5 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    res.status(201).end();
  }
);

// --- exports.foo = ----------------------------------------------------------

exports.normalizeScore = function (raw) {
  return Math.min(5, Math.max(1, Number(raw) || 0));
};

exports.toSlug = (title) =>
  String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

// --- module.exports.foo = ---------------------------------------------------

module.exports.buildSummary = function buildSummaryInner(responses) {
  return { count: responses.length };
};

module.exports.parseCursor = (raw) => {
  if (!raw) return null;
  return Buffer.from(raw, 'base64').toString('utf8');
};

// --- module.exports = { ... } -----------------------------------------------

module.exports = {
  router,
  requireAuth,

  createSurvey: async (req, res) => {
    const survey = await db.insert('surveys', req.body);
    res.status(201).json(survey);
  },

  updateSurvey: function (req, res) {
    res.status(204).end();
  },

  deleteSurvey(req, res) {
    res.status(204).end();
  },

  // a nested namespace object
  admin: {
    banUser: (req, res) => res.status(204).end(),
    purgeResponses: async function (req, res) {
      await db.query('DELETE FROM responses WHERE survey_id = $1', [req.params.id]);
      res.status(204).end();
    },
  },
};

// --- reassignment of the whole export object --------------------------------

const legacyApi = {
  ping: () => 'pong',
};

Object.assign(module.exports, legacyApi);

// --- classic module pattern -------------------------------------------------

const cache = (function initCache() {
  const store = new Map();

  function get(key) {
    return store.get(key);
  }

  const set = (key, value) => {
    store.set(key, value);
    return value;
  };

  return { get, set };
})();

module.exports.cache = cache;
