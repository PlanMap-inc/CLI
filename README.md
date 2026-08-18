# PlanMap

**Catches the code changes that compile, pass tests, and pass review.**

Local. No rules to write. No spec to maintain. Works on any JavaScript or TypeScript repo.

---

## The change that started this

A function was changed from throwing an error to returning `null`:

```diff
  function validateScore(raw) {
-   if (raw == null) throw new ValidationError('score required');
+   if (raw == null) return null;
    return Number(raw);
  }
```

The compiler passed. The tests passed. ESLint passed. An AI code reviewer looked at the diff and said nothing.

Every caller that relied on catching that error now silently receives `null`. Nothing crashes. The behaviour is simply wrong from that point on.

**This is the class of change PlanMap exists to catch.** Not syntax errors — those are already handled. Behavioural changes that survive every existing layer of verification.

---

## What it does

PlanMap parses your code into declarations and extracts **behavioural facts** about each one: how many times it throws, what it throws, whether it returns nullish, what it calls, what numbers it contains, how it handles errors.

It stores those facts as a baseline. Then it watches.

When a fact changes, you hear about it. When formatting changes, you don't.

```
$ planmap check

Comparing baseline → current

  src/auth/token.js::verifyToken:function CHANGED
      throws           1 → 0
      throwTypes       [AuthError] → []
      returnsNullish   0 → 1

1 changed · 0 added · 0 deleted · 12 unchanged
```

That output is from a real run. Reformatting the same file, renaming its local variables, and adding comments produces **zero** changes — verified as a control test.

---

## Install

```bash
npx planmap init      # scan the project, write a baseline
npx planmap watch     # watch for behavioural changes
```

No API key. No account. No config file. Nothing leaves your machine.

---

## Commands

| Command | What it does |
|---|---|
| `init` | Scan the project and write `.planmap/baseline.json` |
| `watch` | Watch files; report behavioural changes as they happen |
| `check` | Compare current code against the baseline. Exits non-zero on change — usable in CI. |
| `accept` | Approve the current state as the new baseline |
| `diff <a> <b>` | Compare two files directly |
| `evolution` | Render the project's change history as a feature tree |

Only `init` and `accept` ever write the baseline. The watcher never does — otherwise a change would erase itself on the next save.

---

## What gets tracked

Ten facts per declaration:

| Fact | Catches |
|---|---|
| `throws` / `throwTypes` | Error handling removed or changed |
| `returns` / `returnsNullish` | A function that threw now returns nothing |
| `calls` | A dependency added or dropped |
| `numbers` | Limits, timeouts, retries, thresholds |
| `awaits` | Sync/async behaviour changed |
| `catches` / `emptyCatches` | Errors newly swallowed |
| `params` | Signature changed |

String literals are deliberately excluded — they are mostly error messages, and they get reworded constantly.

**Why facts and not hashes:** a hash fires on reformatting. Facts don't. A hash tells you *something* changed; facts tell you *what*.

---

## Nested declarations

Extraction stops at the boundary of the next declaration, so each one owns only its own body.

```js
function outer() {
  function inner() {
    throw new Error('x');   // belongs to inner, not outer
  }
}
```

Without this, one nested change makes every enclosing function report as changed.

---

## Evolution graph

`planmap evolution` turns the change history into a feature-oriented tree:

```markdown
- **Login**
  - Added authentication start endpoint `backend` `api`
    - Updated authentication response status `backend` `api`
      - numbers [200,401] → [200,402]
  - Added JWT verification middleware `backend` `security`
  - Added Google Sign-In initialization `frontend`

- **Survey**
  - Added survey start endpoint `backend` `api`
  - Added survey submission service `backend` `database`
```

Features are **capabilities, not layers** — a feature spanning frontend and backend stays one node.

Structure comes from static analysis. Labels are optional and come from an LLM you configure yourself (`OPENROUTER_API_KEY`). Without a key everything still works; nodes are left unlabelled.

**PlanMap never sends your source code anywhere.** Only extracted facts — `calls: [jwt.sign]`, `numbers: [3600] → [7200]` — and only if you enable labelling.

---

## What it is not

Being straight about this matters more than breadth.

- **Not a linter.** It has no opinion about whether your code is good. It reports what changed.
- **Not an AI reviewer.** No model decides what happened. Static analysis determines the facts; the LLM only writes labels.
- **Not a security scanner.**
- **Not a spec tool.** Nothing to write, nothing to maintain. The baseline comes from your code.

---

## How it compares

| | Linters | AI reviewers | PlanMap |
|---|---|---|---|
| Needs rules | Yes | No | No |
| Needs a spec | No | No | No |
| Sees between commits | No | No | **Yes** |
| Sends code to a server | No | Yes | **No** |
| Deterministic | Yes | No | Yes |
| Knows what the code did yesterday | No | No | **Yes** |

A pattern-matching scanner would catch the example above only if someone had written a rule saying that function must throw. Nobody writes that rule.

PlanMap catches it because it remembers what the function did yesterday, with zero configuration.

---

## Status

**v0.4** — working, in active development, dogfooded daily.

| | |
|---|---|
| ✅ | Declaration extraction (JS + TS) |
| ✅ | Behavioural fact extraction |
| ✅ | Baseline, diff, watch, CI exit codes |
| ✅ | Change history and feature tree |
| 🔨 | Significance filtering — stop reporting removed debug lines |
| 🔨 | Dependency map — what calls what |
| 🔨 | Impact analysis — what a change affects downstream |
| 📋 | Python support |

The next release adds the line the tool is missing today:

```
  3 declarations depend on this:
    loadSession     direct
    createOrder     direct
    handleOrder     via loadSession
```

---

## Tech

Node ESM, no build step. [`web-tree-sitter`](https://github.com/tree-sitter/tree-sitter) (WASM), `chokidar` for file watching. Storage is plain JSON in `.planmap/`, committable to git.

Requires Node 18+.

---

## Contributing

Issues welcome, especially:

- A behavioural change PlanMap **missed**
- A change it reported that **didn't matter**

Both are more useful than feature requests right now.

---

## License

MIT
