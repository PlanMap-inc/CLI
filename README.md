<div align="center">

# PlanMap

**Catch the changes your compiler can't see.**

</div>

---

## The problem

You ask an AI agent to clean up a function. It does. The code compiles. Tests pass. The linter is happy. The diff looks reasonable, so you approve it.

What actually happened:

```diff
  function validateScore(raw) {
    const n = Number(raw);
    if (Number.isNaN(n)) {
-     throw new ValidationError('score must be numeric');
+     return null;
    }
```

Nothing crashed. Nothing failed. But the function stopped rejecting bad input and started silently returning nothing. Every caller that relied on it throwing is now wrong, and nobody finds out until the data is already corrupt.

**A compiler checks that code is valid. A linter checks that code is tidy. Tests check the paths you thought to write. None of them check that code still does what it did yesterday.**

That's the gap.

---

## The idea

Write down **facts** about what each function does. Compare those facts over time. When a fact changes, say exactly which one.

Not "this file changed." Not "3 lines differ." Instead:

```
  validateScore     throws           2 → 0
                    throwTypes       [ValidationError] → []
                    returnsNullish   0 → 2

  rateLimit         numbers          [5, 3600] → [500, 3600]

  saveUser          calls            [db.users.insert, hashPassword] → [db.users.insert]
                    awaits           2 → 1
```

Read that as English:

- error handling was removed from `validateScore`
- a rate limit went from 5 to 500
- **password hashing disappeared from `saveUser`**

Every one of those compiles. Every one passes tests. **Every one is a bug.**

---

## Why not just hash the code?

Because a hash tells you *something* changed. It cannot tell you *what*.

| Edit | Hash | PlanMap |
|---|---|---|
| Reformat the file | 🔴 alarm | ✅ silent |
| Rename a local variable | 🔴 alarm | ✅ silent |
| Add a comment | 🔴 alarm | ✅ silent |
| `throw` becomes `return null` | 🔴 alarm | 🚨 `throws: 2 → 0` |

A hash gives the same alarm for all four. After a day of that, you stop reading the alarms.

PlanMap stays quiet for the first three and speaks up for the fourth — naming the actual problem.

---

## No AI at runtime

PlanMap does not ask a language model what changed.

Every fact comes from a parser walking a syntax tree. Same input, same output, every time. No API key, no network, no cost per run, nothing hallucinated.

> Static analysis determines **what** changed. A model may later narrate **why it matters** — but it never decides what happened.

Models hallucinate dependencies. Parsers don't.

---

## Install

```bash
git clone https://github.com/its-sambhav/PLAN_MAP
cd PLAN_MAP
npm install
```

Three dependencies. Tree-sitter for parsing, chokidar for watching files. Nothing else.

---

## Use

**Look at one file**

```bash
node src/cli.js src/auth.js
node src/cli.js src/auth.js --json     # with all extracted facts
```

**Compare two versions of a file**

```bash
node src/cli.js diff before.js after.js
```

**Watch a whole project**

```bash
node src/cli.js init    my-project     # remember the current state
node src/cli.js watch   my-project     # report drift as you save
node src/cli.js check   my-project     # one-shot check, exits 1 on drift
node src/cli.js accept  my-project     # approve the current state
```

`check` exiting non-zero is what makes it work in CI.

---

## How it works

**1. Find every function that can be named.**

Not every piece of code can carry a promise. A named function can. The third anonymous callback inside a `.map()` can't — add another `.map()` above it and it becomes the fourth. If you can't find it again after an edit, it can't be tracked.

Each one gets a stable address:

```
src/auth.js::ResponseValidator.validate:method
src/auth.js::buildValidator.checkLength.withinBounds:function
```

**2. Extract facts about each one.**

Does it throw, and what? How many exit points? What does it call? What numbers does it contain? Does it await? Does it swallow errors? How many parameters?

Numbers are tracked because a number is usually a *rule* — a limit, a timeout, a retry count. Strings aren't, because they're mostly error messages that get reworded constantly.

**3. Compare.**

Two sets of facts, matched by address. Something in the old set and not the new one was **deleted** — the loudest signal there is, and one a forward-only scan would never see.

---

## Memory, not git

Git sees commits. Agent drift happens **between** commits — you accept a change, keep working, and by commit time it's forgotten.

PlanMap keeps its own memory in a `.planmap/` folder:

- **`baseline.json`** — the state you last approved
- **`events.jsonl`** — one line per real change, appended and never rewritten

```json
{"ts":"...","identity":"src/auth.js::validateScore:function","type":"changed","delta":{"throws":[2,0]}}
```

That works on uncommitted code, before the first commit, and on projects with no repository at all.

**The watcher never moves the baseline.** If it did, a drift would vanish on the next save and you'd never know it happened. The baseline moves only when you run `accept` — you saying you've seen it and it's fine.

---

## What it doesn't do

JavaScript only. No dataflow analysis — re-exports and aliases resolve to where they're written, not where they end up. And it hasn't yet been run against a large production codebase, so real code will surprise it in ways the test fixtures don't.

---

<div align="center">

*A compiler checks that code is valid.
A linter checks that code is tidy.
PlanMap checks that code still means what it meant.*

Built by [Sambhav](https://github.com/its-sambhav)

</div>
