<div align="center">

# PlanMap

### Catches the code changes that compile, pass tests, and pass review.

Local · no rules to write · no spec to maintain · works on any repo

[![License: MIT](https://img.shields.io/badge/License-MIT-1f6feb.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-3fb950.svg)](https://nodejs.org)
[![Language](https://img.shields.io/badge/JavaScript%20%C2%B7%20TypeScript-3fb950.svg)](#what-gets-tracked)
[![Status](https://img.shields.io/badge/status-v0.4%20active-d29922.svg)](#status)

</div>

<div align="center">

---

## The change that started this

</div>

```diff
  function validateScore(raw) {
-   if (raw == null) throw new ValidationError('score required');
+   if (raw == null) return null;
    return Number(raw);
  }
```

<div align="center">

| | |
|:--|:--|
| ✅ Compiler | passed |
| ✅ Tests | passed |
| ✅ ESLint | passed |
| ✅ AI code review | said nothing |

Every caller that relied on catching that error now silently receives `null`.

**Nothing crashes. The behaviour is simply wrong from that point on.**

> This is the class of change PlanMap exists to catch.
> Not syntax errors — those are already handled.
> Behavioural changes that survive every existing layer of verification.

---

## What it does

PlanMap extracts **behavioural facts** from every declaration in your code —
what it throws, what it returns, what it calls, how it handles errors.

It stores those facts as a baseline. Then it watches.

### When a fact changes, you hear about it.<br>When formatting changes, you don't.

</div>

```console
$ planmap check

Comparing baseline → current

  src/auth/token.ts::verifyToken:function CHANGED
      throws           1 → 0
      throwTypes       [AuthError] → []
      returnsNullish   0 → 1

1 changed · 0 added · 0 deleted · 12 unchanged
```

<div align="center">

Reformat that same file, rename its locals, add comments — **zero changes reported.**

*Verified as a control test.*

---

## Install

</div>

```bash
npx planmap init      # scan the project, write a baseline
npx planmap watch     # watch for behavioural changes
```

<div align="center">

### No API key · No account · No config<br>Nothing leaves your machine

---

## Commands

| | |
|:--|:--|
| `init` | Scan the project and write `.planmap/baseline.json` |
| `watch` | Watch files; report behavioural changes as they happen |
| `check` | Compare against the baseline. Exits non-zero — usable in CI. |
| `accept` | Approve the current state as the new baseline |
| `diff <a> <b>` | Compare two files directly |
| `evolution` | Render the change history as a feature tree |

> Only `init` and `accept` ever write the baseline.
> The watcher never does — otherwise a change would erase its own evidence.

---

## What gets tracked

**JavaScript · TypeScript · JSX · TSX**

Ten facts per declaration

| Fact | Catches |
|:--|:--|
| `throws` · `throwTypes` | Error handling removed or changed |
| `returns` · `returnsNullish` | A function that threw now returns nothing |
| `calls` | A dependency added or dropped |
| `numbers` | Limits, timeouts, retries, thresholds |
| `awaits` | Sync/async behaviour changed |
| `catches` · `emptyCatches` | Errors newly swallowed |
| `params` | Signature changed |

String literals are deliberately excluded —
they're mostly error messages, and they get reworded constantly.

<details>
<summary><b>Why facts and not hashes?</b></summary>

<br>

| Edit | Hash | Facts |
|:--|:--:|:--:|
| Reformat | 🔴 fires | 🟢 silent |
| Rename a local | 🔴 fires | 🟢 silent |
| Add a comment | 🔴 fires | 🟢 silent |
| `throw` → `return null` | 🔴 fires | 🔴 `throws: 1 → 0` |

A hash tells you *something* changed. Facts tell you **what**.

</details>

<details>
<summary><b>How nested declarations are handled</b></summary>

<br>

Extraction stops at the boundary of the next declaration,
so each one owns only its own body.

Without this, one nested change makes every enclosing function report as changed.

</details>

<details>
<summary><b>TypeScript specifics</b></summary>

<br>

`.ts` and `.tsx` use separate grammars — in `.tsx`, `<Foo>` is JSX;
in `.ts` it's a type assertion.

Handled: classes, abstract classes, namespaces, decorators,
generics, overloads, getters and setters, `static` and `#private` members,
parameter properties, `satisfies`, and class fields holding functions.

`.d.ts` files are skipped — type declarations have no behaviour to extract.
So are `dist`, `build`, `out`, and `.next`, to avoid parsing compiled output
alongside its source.

</details>

---

## Validated on real code

PlanMap has been run across **9 open-source TypeScript repositories**

| | |
|:--|:--|
| **16,328** | declarations parsed |
| **0** | identity collisions |
| **9 / 9** | repositories scanned successfully |

*TanStack Query · tRPC · Zod · Remeda · type-fest · got · ky · Zustand · ofetch*

A file that fails to parse is skipped and reported — never fatal.
One unsupported construct does not cost you the other 900 files.

---

## Evolution graph

Turns the change history into a feature-oriented tree

</div>

```markdown
- **Login**
  - Added authentication start endpoint  `backend` `api`
    - Updated authentication response status  `backend` `api`
      - numbers [200,401] → [200,402]
  - Added JWT verification middleware  `backend` `security`
  - Added Google Sign-In initialization  `frontend`

- **Survey**
  - Added survey start endpoint  `backend` `api`
  - Added survey submission service  `backend` `database`
```

<div align="center">

Features are **capabilities, not layers** —
a feature spanning frontend and backend stays one node.

Structure comes from static analysis.
Labels are optional and come from an LLM you configure yourself.
Without a key everything still works — nodes fall back to deterministic labels.

### 🔒 PlanMap never sends your source code anywhere.

Only extracted facts — `calls: [jwt.sign]`, `numbers: [3600] → [7200]` —
and only if you enable labelling.

---

## How it compares

| | Linters | AI reviewers | **PlanMap** |
|:--|:--:|:--:|:--:|
| Needs rules | ✅ yes | ❌ no | ❌ no |
| Needs a spec | ❌ no | ❌ no | ❌ no |
| Sees between commits | ❌ no | ❌ no | **✅ yes** |
| Sends code to a server | ❌ no | ⚠️ yes | **❌ no** |
| Deterministic | ✅ yes | ❌ no | **✅ yes** |
| Knows what the code did yesterday | ❌ no | ❌ no | **✅ yes** |

A pattern-matching scanner catches the example at the top
**only if someone wrote a rule** saying that function must throw.

Nobody writes that rule.

**PlanMap catches it because it remembers what the function did yesterday.**

---

## What it is not

**Not a linter** — no opinion about whether your code is good

**Not an AI reviewer** — static analysis decides what happened, not a model

**Not a security scanner**

**Not a spec tool** — nothing to write, nothing to maintain

---

## Status

**v0.4.1** — working, in active development, dogfooded daily

| | |
|:--|:--|
| ✅ | Declaration extraction — JavaScript, TypeScript, JSX, TSX |
| ✅ | Behavioural fact extraction |
| ✅ | Baseline · diff · watch · CI exit codes |
| ✅ | Change history and feature tree |
| 🔨 | Sessions — group saves into one unit of work |
| 🔨 | Significance filtering — stop reporting removed debug lines |
| 🔨 | Dependency map — what calls what |
| 🔨 | Impact analysis — what a change affects downstream |
| 📋 | Python |

**Next release** adds the line the tool is missing today

</div>

```console
  3 declarations depend on this:
    loadSession     direct
    createOrder     direct
    handleOrder     via loadSession
```

<div align="center">

---

## Tech

Node ESM, no build step
[`web-tree-sitter`](https://github.com/tree-sitter/tree-sitter) (WASM) for parsing · `chokidar` for watching
Storage is plain JSON in `.planmap/`, committable to git

Design decisions and their reasoning: [`DECISIONS.md`](DECISIONS.md)

---

## Contributing

Issues welcome — especially these two

> 🐛 **A behavioural change PlanMap missed**
>
> 🔇 **A change it reported that didn't matter**

Both are more useful than feature requests right now.

---

<br>

**MIT** · built by [@its-sambhav](https://github.com/its-sambhav)

</div>
