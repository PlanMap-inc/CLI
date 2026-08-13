// ---------------------------------------------------------------------------
// test.js — adversarial fixture for PlanMap structural inventory
// A survey backend module. Every construct here appears in real Express code.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

// --- 1. plain declarations -------------------------------------------------

function normalizeEmail(raw) {
  return String(raw).trim().toLowerCase();
}

async function loadSurvey(db, id) {
  const row = await db.query('SELECT * FROM surveys WHERE id = $1', [id]);
  return row.rows[0] ?? null;
}

function* paginate(items, size) {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}

// --- 2. arrows and function expressions bound to variables -----------------

const getSurvey = async (req, res) => {
  const survey = await loadSurvey(req.db, req.params.id);
  if (!survey) return res.status(404).json({ error: 'not found' });
  res.json(survey);
};

let submitResponse = async function (req, res) {
  const id = randomUUID();
  await req.db.query('INSERT INTO responses (id, body) VALUES ($1, $2)', [id, req.body]);
  res.status(201).json({ id });
};

var legacyHandler = function namedInnerHandler(req, res) {
  res.status(410).end();
};

// two declarators, one statement
const parseLimit = (q) => Number(q.limit) || 25,
      parseOffset = (q) => Number(q.offset) || 0;

// curried — an arrow that returns an arrow
const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).end();
  next();
};

// --- 3. functions that are not bound to a variable at all ------------------

const routeTable = {
  listSurveys(req, res) {
    res.json([]);
  },
  deleteSurvey: (req, res) => {
    res.status(204).end();
  },
  archiveSurvey: function (req, res) {
    res.status(204).end();
  },
};

let deferredHandler;
deferredHandler = (req, res) => res.end();

const { onError = (err) => console.error(err) } = {};

// --- 4. anonymous callbacks nested inside calls ----------------------------

function summarize(responses) {
  const scores = responses.map((r) => r.score ?? 0);
  const valid = scores.filter(function (s) {
    return s > 0;
  });

  setTimeout(() => {
    console.log('summary flushed');
  }, 1000);

  return valid.reduce((acc, s) => acc + s, 0) / (valid.length || 1);
}

(function bootstrapMetrics() {
  console.log('metrics online');
})();

(() => {
  console.log('anonymous iife');
})();

// --- 5. nesting -------------------------------------------------------------

function buildValidator(rules) {
  function checkRequired(value) {
    return value !== undefined && value !== null;
  }

  const checkLength = (value) => {
    const trimmed = String(value).trim();

    function withinBounds(n) {
      return n >= rules.min && n <= rules.max;
    }

    return withinBounds(trimmed.length);
  };

  return (value) => checkRequired(value) && checkLength(value);
}

// --- 6. classes -------------------------------------------------------------

class ResponseValidator {
  static registry = new Map();

  static {
    ResponseValidator.registry.set('default', null);
  }

  // a class field holding an arrow function
  handleTimeout = (ctx) => {
    ctx.abort();
  };

  constructor(schema) {
    this.schema = schema;
  }

  validate(payload) {
    return this.#applyRules(payload);
  }

  #applyRules(payload) {
    return Object.keys(this.schema).every((k) => k in payload);
  }

  async validateMany(items) {
    return items.map((i) => this.validate(i));
  }

  static fromSchema(schema) {
    return new ResponseValidator(schema);
  }

  get ruleCount() {
    return Object.keys(this.schema).length;
  }

  set ruleCount(_) {
    throw new Error('read only');
  }

  ['dynamic' + 'Check'](payload) {
    return Boolean(payload);
  }

  *[Symbol.iterator]() {
    yield* Object.entries(this.schema);
  }
}

// class expression bound to a variable
const AnonValidator = class {
  check() {
    return true;
  }
};

const NamedValidator = class InnerNamedValidator {
  check() {
    return true;
  }
};

// --- 7. default parameters that are themselves functions --------------------

function withRetry(fn, onFail = (e) => console.warn(e.message), attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return fn();
    } catch (e) {
      onFail(e);
    }
  }
  return null;
}

// --- 8. exports -------------------------------------------------------------

export function registerRoutes(app) {
  app.get('/surveys/:id', getSurvey);
  app.post('/responses', submitResponse);
}

export const healthCheck = (req, res) => res.json({ ok: true });

export default function (app) {
  registerRoutes(app);
}
