// ---------------------------------------------------------------------------
// collisions.js — every name in here is deliberately reused.
// If your identity scheme is sound, zero duplicate warnings should fire.
// ---------------------------------------------------------------------------

// --- same name, three different scopes -------------------------------------

function process(input) {
  function process(inner) {
    return inner * 2;
  }
  return process(input);
}

const pipeline = {
  process: (input) => input + 1,
};

class Worker {
  process(input) {
    return input;
  }
}

// --- static vs instance, same class ----------------------------------------

class Limiter {
  static reset() {
    Limiter.count = 0;
  }

  reset() {
    this.count = 0;
  }

  static get limit() {
    return 100;
  }

  get limit() {
    return this._limit;
  }

  static set limit(v) {
    Limiter._limit = v;
  }

  set limit(v) {
    this._limit = v;
  }

  static async flush() {
    return true;
  }

  async flush() {
    return false;
  }
}

// --- two classes, identical method names -----------------------------------

class EmailValidator {
  validate(v) {
    return v.includes('@');
  }
  get errors() {
    return [];
  }
}

class PhoneValidator {
  validate(v) {
    return v.length === 10;
  }
  get errors() {
    return [];
  }
}

// --- two objects, identical keys -------------------------------------------

const userRoutes = {
  handler: (req, res) => res.end(),
  guard: function (req, res, next) {
    next();
  },
};

const adminRoutes = {
  handler: (req, res) => res.end(),
  guard: function (req, res, next) {
    next();
  },
};

// --- a class and a function sharing a name in different scopes -------------

class Report {
  render() {
    return '';
  }
}

function makeReport() {
  class Report {
    render() {
      return 'nested';
    }
  }
  return new Report();
}

// --- same name as field, method, and free function --------------------------

class Tracker {
  flush = () => {
    this.buffer = [];
  };

  record(event) {
    this.buffer.push(event);
  }
}

function flush() {
  return null;
}

const flushAll = function flush() {
  return null;
};

// --- deep shadowing chain ---------------------------------------------------

function outer() {
  const run = () => {
    function run() {
      const run = () => 3;
      return run();
    }
    return run();
  };
  return run();
}
