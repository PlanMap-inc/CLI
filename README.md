<div align="center">

# PlanMap

**Catch the changes your compiler can't see.**

A static analysis tool that detects when code silently changes behaviour —
the kind of change that compiles, passes tests, and quietly breaks a promise.

`v0.2` · JavaScript · Zero AI at runtime

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

Nothing crashed. Nothing failed. But the function stopped rejecting bad input and started silently returning nothing. Every caller that relied on it throwing is now wrong, and nobody finds out until data is already corrupt.

**A compiler checks that code is valid. A linter checks that code is tidy. Tests check the paths you thought to write. None of them check that code still does what it did yesterday.**

That's the gap PlanMap fills.

---

## What PlanMap does

It reads your code and writes down **facts** about what each function does. Then it compares those facts across versions and tells you which ones changed.

```
$ planmap diff before.js after.js

Comparing before.js → after.js

  validateScore:function           CHANGED
      throws           2 → 0
      throwTypes       [ValidationError] → []
      returnsNullish   0 → 2

  rateLimit:function               CHANGED
      numbers          [5, 3600] → [500, 3600]

  saveUser:function                CHANGED
      calls            [db.users.insert, hashPassword] → [db.users.insert]
      awaits           2 → 1

  getSession:function              CHANGED
      params           1 → 2

  cleanup:function                 CHANGED
      catches          1 → 2
      emptyCatches     0 → 1

  legacyExport:function            DELETED
  healthCheck:function             ADDED

5 changed · 1 added · 1 deleted · 2 unchanged
```

Read that output again. It isn't saying *"something changed."* It's saying:

- error handling was removed from `validateScore`
- a rate limit went from 5 to 500
- **password hashing disappeared from `saveUser`**
- a function signature changed
- an error is now being swallowed silently

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

PlanMap stays quiet for the first three and speaks up for the fourth — in words that name the actual problem.

---

## No AI at runtime

PlanMap does not call a language model to decide what changed.

Every fact in the output comes from a parser walking a syntax tree. Same input, same output, every single time. No API key, no network, no cost per run, no hallucinated dependencies.

> **The principle:** static analysis determines *what* changed. A model may later narrate *why it matters* — but it never decides *what happened*.

This is deliberate. Models hallucinate dependencies; parsers don't. Any tool that asks a model "did this change break something?" is building on sand.

---

## Install

```bash
git clone https://github.com/its-sambhav/PLAN_MAP
cd PLAN_MAP
npm install
```

Two dependencies. That's the whole tree.

| Package | Purpose |
|---|---|
| `web-tree-sitter` | Tree-sitter compiled to WebAssembly |
| `tree-sitter-javascript` | The JavaScript grammar |

<details>
<summary><b>Why WASM instead of native bindings</b></summary>

<br>

The native `tree-sitter` module is a compiled N-API addon. It must be rebuilt against Electron's ABI to work inside a VS Code extension — which means shipping per-platform prebuilds and running `electron-rebuild` on every Electron bump.

WASM avoids all of it. Parse cost is irrelevant at single-file scale.

**Import gotcha:** `import JavaScript from 'tree-sitter-javascript'` resolves to `bindings/node`, the native path, and needs the native peer dependency. Load the `.wasm` file by path instead:

```
node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm
```

Resolve that path from `import.meta.url`, never from `process.cwd()`. The CLI is always run from inside *another* project's directory.

</details>

---

## Usage

```bash
# List every declaration in a file
node src/cli.js path/to/file.js

# Same, as JSON, with all extracted facts
node src/cli.js path/to/file.js --json

# Compare two versions of a file
node src/cli.js diff before.js after.js
```

### Inventory output

```
File: test/v0.2/before.js

kind                    name            location
------------------------------------------------------------
function                validateScore   13:0-25:1
function                rateLimit       29:0-34:1
function                saveUser        38:0-42:1
function                getSession      46:0-48:1
function                cleanup         52:0-60:1
function                parseBody       66:0-71:1
function                legacyExport    75:0-77:1
function                normalizeEmail  81:0-83:1

8 declarations
```

---

## How it works

```
  source file
       │
       ▼
  ┌─────────────┐
  │   parse     │  tree-sitter → syntax tree
  └─────────────┘
       │
       ▼
  ┌─────────────┐
  │    walk     │  find every addressable declaration
  └─────────────┘  → qualified name + identity
       │
       ▼
  ┌─────────────┐
  │ properties  │  extract facts about each one
  └─────────────┘  → throws, calls, numbers, params…
       │
       ▼
  ┌─────────────┐
  │    diff     │  compare two sets of facts
  └─────────────┘  → changed / added / deleted
```

Four stages, four files, each pure and independently testable.

### Stage 1 — Finding declarations

Tree-sitter has no concept of a "declaration." It describes grammar: roughly 200 node types covering every bracket and identifier. Choosing which ones matter is a product decision, not a parsing fact.

**The rule: match the node that owns the name.**

```js
const getSurvey = async (req, res) => { ... };
```

The `arrow_function` has the body but **no name**. The `variable_declarator` above it has the name but no body. Match the arrow and you get an anonymous entry that's useless as an anchor. Match the declarator, then check what it holds.

Eight node types can own a name:

| Node type | Name field | Value field |
|---|---|---|
| `function_declaration` | `name` | — |
| `generator_function_declaration` | `name` | — |
| `class_declaration` | `name` | — |
| `method_definition` | `name` | — |
| `variable_declarator` | `name` | `value` |
| `pair` | `key` | `value` |
| `field_definition` | `property` | `value` |
| `assignment_expression` | `left` | `right` |

The last four are *binders* — they hold a name and point at a function. This is why `module.exports.handler = (req, res) => {}` and `{ handler: (req, res) => {} }` are both found.

### Stage 2 — Identity

A display name isn't an address. Scope is threaded down the recursion as a parameter, so nested declarations get qualified:

```
buildValidator.checkLength.withinBounds
ResponseValidator.validateMany
module.exports.admin.purgeResponses
```

Identity adds kind, and `static` when present:

```
ResponseValidator.validate:method
ResponseValidator.fromSchema:method:static
ResponseValidator.ruleCount:getter
ResponseValidator.ruleCount:setter
```

**A modifier belongs in the identity if and only if it lets two declarations coexist in the same slot.**

| Modifier | Coexists? | In identity? |
|---|---|---|
| `get` / `set` | yes — both can exist for one name | ✅ |
| `static` | yes — one on the constructor, one on the prototype | ✅ |
| `async` | no — the second definition just wins | ❌ |
| `generator` | no | ❌ |

`async` is recorded as a modifier but excluded from the address. If it were included, adding `async` to a function would read as *one declaration deleted, one created* — dropping any intent bound to it. That is exactly the change PlanMap should catch, not lose.

### Stage 3 — Properties

Ten facts, extracted from the AST:

| Fact | What it catches |
|---|---|
| `throws` | error handling silently removed |
| `throwTypes` | which error type disappeared |
| `returns` | exit points added or removed |
| `returnsNullish` | returning `null` where it used to throw |
| `calls` | `hashPassword` vanishing from a login path |
| `numbers` | a rate limit changed from `5` to `500` |
| `awaits` | async code turned synchronous |
| `catches` | error handling added or removed |
| `emptyCatches` | errors swallowed silently |
| `params` | signature drift |

**String literals are deliberately excluded.** Strings are mostly error messages, and people reword them constantly — they'd fire every run and mean nothing. Numbers are different: a number is usually a *rule* (a limit, a timeout, a retry count), so a change to one is meaningful.

#### The nested-declaration boundary

The single most important rule in the extractor.

```js
function outer(x) {
  const inner = (y) => { throw new InnerError('deep'); };
  return inner(x);
}
```

When extracting facts for `outer`, the walk **stops** the moment it reaches `inner`. Each declaration owns only its own body.

Without this, one change deep inside a nested function makes every enclosing function report as changed too. Verified behaviour:

```
$ planmap diff nest_a.js nest_b.js

  outer.inner:function             CHANGED
      throws           1 → 0
      throwTypes       [InnerError] → []
      returnsNullish   0 → 1

1 changed · 0 added · 0 deleted · 1 unchanged
```

`outer` correctly stays silent.

#### Sorting and deduplication

`calls`, `throwTypes`, and `numbers` are sorted and deduplicated before storage. Without sorting, reordering two calls produces a phantom diff. Without dedup, calling the same function twice instead of once fires for no behavioural reason.

### Stage 4 — Diff

Identity sets are compared **in both directions**:

| Check | Result |
|---|---|
| in before, missing from after | `DELETED` |
| in after, missing from before | `ADDED` |
| in both, facts differ | `CHANGED` |
| in both, facts identical | unchanged |

The two-way comparison matters. A one-pass walk over the new file can never see a **deleted** function — it isn't there to be found. And deleting a function that carried a promise is the loudest signal there is.

---

## Design decisions

<details>
<summary><b>The stable identity test</b> — what makes it into the inventory</summary>

<br>

A declaration is tracked only if you could find *this exact thing* again after the file is edited.

- A named function → yes, search by name
- A class method → yes, class name plus method name
- The third anonymous arrow inside a `.map()` → **no.** Add another `.map()` above it and it becomes the fourth. There is nothing to hold on to.

If you can't find it again, you can't detect drift on it, so it doesn't belong. This is what keeps the output from becoming noise.

</details>

<details>
<summary><b>Computed property names are skipped</b></summary>

<br>

```js
class Store {
  ['dynamic' + 'Purge'](before) { ... }
}
```

This method has no name until the program runs. It can never be a stable anchor, so it is excluded rather than guessed at.

</details>

<details>
<summary><b>Named function expressions record the outer binding</b></summary>

<br>

```js
const flushAll = function flush() { ... };
```

Recorded as `flushAll`. That's the address callers actually use. The inner name exists only for self-reference and stack traces.

The same applies to class expressions: `const NamedValidator = class Inner {}` yields `NamedValidator.check`, not `NamedValidator.Inner.check`. Nothing outside the class body can reach the inner name.

</details>

<details>
<summary><b>IIFE scope uses the function's own name</b></summary>

<br>

```js
const cache = (function initCache() {
  function get(key) { ... }
  return { get };
})();
```

Produces `initCache.get`, not `cache.get`. Resolving the return value to the `cache` binding requires dataflow analysis, which is deliberately out of scope.

A known imprecision, documented rather than hidden.

</details>

<details>
<summary><b>Returns are compared after subtracting nullish returns</b></summary>

<br>

`returns` counts every return statement, including `return null`. When a `throw` becomes a `return null`, both counters move, and the change would be reported twice.

The diff compares `returns - returnsNullish` instead, so `returnsNullish` reports the real change and `returns` stays quiet.

</details>

<details>
<summary><b>Parse errors exit non-zero with no output</b></summary>

<br>

Tree-sitter recovers from syntax errors rather than throwing, so a broken file still produces a tree — a *wrong* one:

```
function good1() { return 1; }
function broken( {
function good2() { return 2; }
```

`broken` vanishes, and `good2` gets misclassified as a **method**, changing its identity from `good2:function` to `good2:method`.

At save-time checking, one unbalanced brace mid-edit would report a wave of fake deletions and additions. A partial parse gives a wrong answer that looks like a right one, so PlanMap refuses to answer at all.

</details>

---

## Testing

Six fixtures, each built to break a specific assumption.

| Fixture | Targets | Expected |
|---|---|---|
| `test.js` | generators, class fields, static blocks, object members three ways, destructuring defaults, curried arrows, three-level nesting, computed names, `export default` | 34 declarations |
| `collisions.js` | every name deliberately reused — `process` in four scopes, static/instance pairs, four `limit` accessors, shadowed classes, a four-level `run` chain | 38 declarations, **zero** duplicate identities |
| `cjs-router.js` | CommonJS — `exports.foo`, `module.exports.foo`, `module.exports = {}`, nested namespaces, the IIFE module pattern | 15 declarations |
| `annotated.js` | annotation anchoring targets (v0.4) | 13 declarations |
| `v0.2/before.js` · `v0.2/after.js` | eight deliberate behavioural changes | see below |

### The control case

`parseBody` appears in both drift fixtures. In `after.js` it has been reformatted, had a comment added, and a local variable renamed. Its behaviour is identical.

**It must report zero changes.**

If `parseBody` ever fires, the facts are no better than a hash and the entire approach is noise. It is the single pass/fail test for the project.

```bash
node src/cli.js diff test/v0.2/before.js test/v0.2/after.js
# parseBody and normalizeEmail must appear in "unchanged"
```

---

## Roadmap

| Version | Adds | Proves | Status |
|---|---|---|---|
| **v0.1** | Structural inventory | code is addressable | ✅ done |
| **v0.2** | Property extraction + diff | behavioural change is detectable | ✅ done |
| **v0.3** | Baseline on disk + save-time watching | it runs by itself | next |
| **v0.4** | Intent bound to declarations | promises can be stated | |
| **v0.5** | `planmap check` in CI, `planmap accept` | it holds a line | |
| **v0.6** | Event log → project evolution history | the full picture | |

### Why not git

Git sees commits. Agent drift happens **between** commits — the developer accepts a change and keeps working, and by commit time it's already forgotten.

PlanMap keeps its own history in `.planmap/`, keyed by declaration rather than by line. That works on uncommitted code, before the first commit, and on projects with no repository at all.

---

## Project layout

```
src/
  cli.js          argument handling, parser setup, output
  walk.js         traversal → declarations with identity
  properties.js   declaration → facts
  diff.js         two fact-sets → change list
  nodes.js        shared node helpers
test/
  test.js             adversarial general fixture
  collisions.js       identity stress test
  cjs-router.js       CommonJS shapes
  annotated.js        annotation targets
  v0.2/
    before.js         drift pair — before
    after.js          drift pair — after
DECISIONS.md      why the traversal does what it does
```

`walk.js`, `properties.js`, and `diff.js` are pure — no file reading, no printing, no global state. Everything with side effects lives in `cli.js`.

---

## Known limitations

- **JavaScript only.** TypeScript needs its own grammar plus `interface_declaration`, `type_alias_declaration`, and `enum_declaration`. The binder table is designed to extend by adding rows.
- **No dataflow analysis.** Re-exports, aliasing, and IIFE return values resolve to their syntactic location, not their semantic one.
- **`throw makeError(new Wrapped())`** reports `Wrapped`, though the real thrown type is whatever `makeError` returns.
- **`return void 0`** isn't counted as a nullish return. `return undefined` is.
- **Not yet run against a large production repository.** Every fixture here was written to test rules that were already known. Real code surprises differently.

---

<div align="center">

Built by [Sambhav](https://github.com/its-sambhav)

*A compiler checks that code is valid.
A linter checks that code is tidy.
PlanMap checks that code still means what it meant.*

</div>
