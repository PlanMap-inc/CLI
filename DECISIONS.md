# DECISIONS

Architectural decisions made while building PlanMap, with the reasoning that produced them.

Every entry has been verified against the source. The **Verified in** column names the file and mechanism that implements it. If a future change contradicts an entry here, either the change is wrong or this document needs updating — do not leave them disagreeing.

Format: what was decided · why · what it prevents · where it lives.

---

## 1. Identity

### 1.1 — Match the node that owns the name, not the function node

**Decision:** a declaration is anchored to the node holding the identifier, not the node holding the body.

**Why:** `const getSurvey = () => {}` — the `arrow_function` has the body but no name; the `variable_declarator` has the name. Anchoring to the function node loses the identity.

**Eight name-owning node types:** `function_declaration`, `generator_function_declaration`, `class_declaration`, `method_definition`, `variable_declarator`, `pair`, `field_definition`, `assignment_expression`.

**Verified in:** `walk.js` — one branch per type, each calling `createDeclaration` with a qualified name.

---

### 1.2 — Identity is `<qualified name>:<kind>[:static]`

**Decision:** a modifier belongs in identity only if it lets two declarations coexist in the same slot.

| Modifier | In identity? | Reason |
|---|---|---|
| `static` | Yes | A static and instance method of the same name can coexist |
| `get` / `set` | Yes (via `kind`) | A getter and setter of the same name can coexist |
| `async` | **No** | Cannot coexist with a sync version of the same name |
| `generator` | **No** | Same |

**What it prevents:** if `async` were in the identity, adding `async` to a function would read as *delete + create* rather than *change* — dropping any intent bound to it and breaking lineage.

**Verified in:** `walk.js::createDeclaration` — `identityParts = [name, kind]`, `static` pushed conditionally. `async` and `generator` are recorded in `modifiers` but never enter the identity.

---

### 1.3 — Identity is prefixed with the relative file path

**Decision:** `src/auth/token.js::verifyToken:function`

**Why:** two files can declare the same name. Without the prefix they collide in the baseline.

**Consequence:** this is what makes multi-language projects work in one baseline — a Python and a JS declaration can never collide.

**Verified in:** `scanner.js::scanProject` — `${relativeFile}::${declaration.identity}`.

---

### 1.4 — Relative paths, forward slashes, always

**Decision:** never store absolute paths. Normalise separators to `/`.

**Why:** the baseline is committed to git and shared. Absolute paths break on every other machine; backslashes break cross-platform.

**Verified in:** `scanner.js` — `path.relative(...).split(path.sep).join("/")`.

---

### 1.5 — Anonymous declarations are skipped

**Decision:** if a name resolves to `<anonymous>`, no declaration is recorded.

**Why:** the stable identity test — *can I find this exact thing again after an edit?* An anonymous callback fails it. Recording it produces an identity that changes whenever surrounding code moves.

**Verified in:** `walk.js` — every branch guards on `name !== "<anonymous>"`.

---

### 1.6 — Computed property names are skipped

**Decision:** `{ [key]: fn }` produces no declaration.

**Why:** no static name exists. The key is only known at runtime.

**Verified in:** `walk.js` — `nameNode.type !== "computed_property_name"` on method and pair branches.

---

### 1.7 — A named function expression does not double-bind

**Decision:** `const a = function b() {}` records the outer binding (`a`), and `b` does not additionally enter scope.

**Why:** otherwise one declaration produces two identities.

**Verified in:** `walk.js` — the `alreadyBound` check against parent type.

---

### 1.8 — IIFE scope uses the function's own name

**Decision:** an IIFE assigned to a variable scopes its contents under that function's name — `initCache.get`, not `cache.get`.

**Why:** following the returned object into an outer binding is dataflow analysis, which is out of scope. The function name is statically available; the eventual binding is not.

---

### 1.9 — Parse errors are strict for single-file parsing, skippable during project scans

**Decision:** a file with parse errors produces no declarations. Single-file parsing remains strict and fails non-zero. Project scans (`init`, `check`, and `watch`) skip the affected file, warn, and continue scanning the remaining source files.

**Why:** a genuinely broken file can cause tree-sitter to misclassify subsequent functions, silently corrupting identities after the error point. Returning partial declarations from that file is therefore unsafe. But failing an entire project scan because one file uses a valid TypeScript construct unsupported by the installed grammar makes PlanMap unusable on otherwise valid projects. Skipping that file preserves correctness while allowing the rest of the project to be analysed.

**Consequence:** project scans may produce a partial baseline when one or more files cannot be parsed. Skipped files must be reported to the user. A strict mode may be used when callers require the scan to fail on any parse error.

**Verified in:** `parser.js` — parse errors are surfaced to the caller; `scanner.js` — project scanning skips files whose parser reports an error; `commands/init.js`, `check.js`, and `watcher.js` — project-level commands continue with the remaining files.

---

## 2. Properties

### 2.1 — Facts, not hashes

**Decision:** compare extracted behavioural facts, not content hashes.

**Why:**

| Edit | Hash | Facts |
|---|---|---|
| Reformat | fires | silent |
| Rename local | fires | silent |
| Add comment | fires | silent |
| `throw` → `return null` | fires | `throws: 1 → 0` |

A hash says *something* changed. Facts say *what*.

**Verified in:** `properties.js::extractProperties`, `diff.js::diffProperties`.

---

### 2.2 — Extraction stops at the next declaration

**Decision:** each declaration owns only its own body. The walk halts at any nested declaration.

**Why:** without it, one change in a nested function makes every enclosing function report as changed — cascading noise that grows with nesting depth.

**Verified in:** `properties.js` — `isNestedDeclaration(node)` checked in `visit()`, guarded by `isRoot` so the declaration's own node is not treated as its own boundary.

---

### 2.3 — String literals are excluded

**Decision:** string contents are not extracted as a property.

**Why:** strings are mostly error messages, reworded constantly. Numbers, by contrast, are usually *rules* — limits, timeouts, thresholds, status codes.

**Known cost:** prompt-template drift in LLM applications is invisible to PlanMap. This is accepted, not overlooked. Revisit only with evidence.

**Verified in:** `properties.js` — no string extraction exists.

---

### 2.4 — `returns` is compared as `returns − returnsNullish`

**Decision:** the diff compares *normal* returns, not raw returns.

**Why:** `throw → return null` increments both `returns` and `returnsNullish`. Comparing raw returns reports it twice, as two unrelated changes.

**Verified in:** `diff.js` — `returns` is deliberately absent from the `keys` array and handled in its own block computing `beforeReturns − beforeNullish`.

---

### 2.5 — Array properties are sorted and deduplicated

**Decision:** `throwTypes`, `calls`, and `numbers` are passed through `Set` and sorted before storage.

**Why:** without it, reordering statements produces a false change.

**Verified in:** `properties.js` — the SORT + DEDUPLICATE block.

---

## 3. Baseline

### 3.1 — Only `init` and `accept` write the baseline

**Decision:** the watcher never writes it. Neither does `check`.

**Why:** auto-updating makes drift vanish on the next save — the change erases its own evidence. This is the failure mode criticised in competing tools.

**Verified in:** exactly two `writeBaseline` call sites — `commands/init.js:87` and `commands/accept.js:79`. Nothing in `watcher/` or `check.js` writes it.

---

### 3.2 — No line numbers in the baseline

**Decision:** the baseline stores `identity`, `file`, `kind`, `properties`. Nothing positional.

**Why:** line numbers churn on every edit above them. Storing them would make every declaration in a file report as changed when one line is inserted at the top.

**Verified in:** `baseline.js::createBaseline` — startIndex, endIndex, and line/column fields are all dropped.

---

### 3.3 — The baseline is sorted by identity

**Decision:** stable ordering before writing.

**Why:** the baseline is committed to git. Unstable ordering produces meaningless diffs on every scan.

**Verified in:** `baseline.js` — `localeCompare` sort.

---

### 3.4 — The baseline carries a version number

**Decision:** `version: 1`, checked on read, hard exit on mismatch.

**Why:** a format change against an old baseline produces silently wrong diffs. Fail loudly instead.

**Verified in:** `baseline.js` (`BASELINE_VERSION`), `check.js::checkBaselineVersion`.

---

## 4. Events

### 4.1 — Append-only, never rewritten

**Decision:** `events.jsonl` is only appended to.

**Why:** it is the one artifact that cannot be reconstructed. The baseline can be regenerated by rescanning; history cannot.

**Verified in:** `events.js` — only `appendFileSync` is used.

---

### 4.2 — Deltas are compact

**Decision:** an event stores only the properties that changed, as `[before, after]`. Never the full declaration.

**Why:** measured — full declaration objects produced ~900 bytes per event; the compact form is ~120.

**Verified in:** `events.js::createCompactDelta`.

---

### 4.3 — Deduplicate against the last event only

**Decision:** an event is dropped if it matches the immediately preceding line. Not any earlier line.

**Why:** chokidar can deliver one logical change twice. But comparing against all history would wrongly suppress a legitimate recurrence:

```
200 → 203     recorded
200 → 203     dropped (duplicate)
203 → 200     recorded
200 → 203     recorded  ← must not be suppressed
```

**Verified in:** `events.js::appendEvent` — compares `lines[lines.length - 1]` only.

---

### 4.4 — `unchanged` is never recorded

**Decision:** only `added`, `changed`, and `deleted` produce events.

**Verified in:** `events.js::appendEvent` — early return on any other type.

---

### 4.5 — Initial events are written once

**Decision:** `appendInitialEvents` is a no-op if `events.jsonl` is non-empty.

**Why:** re-running `init` would otherwise duplicate the entire project history.

**Verified in:** `events.js::appendInitialEvents`.

---

## 5. Evolution graph

### 5.1 — Features are capabilities, never layers

**Decision:** the top level of the tree is user-facing capability. Never Controller / Service / Middleware.

**Why:** a real feature spans layers. Layer-first grouping shreds Login into three separate places, and makes plan/evolution comparison impossible — two graphs on different axes cannot be joined.

**The acceptance test (mixed-tag test):** a correctly-grouped feature has *mixed* tags. If `Authentication` is all `backend` and `Login` is all `frontend`, the grouping has failed and they are the same feature split by layer.

---

### 5.2 — Lineage is flat, not chained

**Decision:** every `changed` event is a child of the `added` event that created the declaration. Changes are siblings of each other, never nested.

**Why:** chaining produces a staircase — a function edited ten times renders ten levels deep and becomes unreadable.

**Verified in:** `evolution/events.js:191–235` — `latestEvents` is set on `added` and deliberately **not** replaced on `changed`, with an inline comment stating the anchor rule.

---

### 5.3 — Tags describe layer; features describe capability

**Decision:** tags are the technical axis (`backend`, `frontend`, `api`, `security`, `database`). Features are the product axis.

**Rule:** a tag must be reusable across features. A tag that names one feature (`authentication`) is a modelling error — it duplicates the feature name on the wrong axis.

**Cap:** the project-wide tag vocabulary stays small. Settled at five.

---

### 5.4 — Labels and tags freeze once written

**Decision:** an existing node is never re-sent to the model. Only new events are labelled.

**Why:** three reasons. Cost — re-labelling the whole graph on every run. Git churn — labels changing on unrelated runs. Trust — a node that renames itself between runs is not a record.

**Verified in:** `llm/prompts.js:20–21, 374–385` — `existingFeatures` and `existingTags` are passed as context for reuse, not for revision.

---

### 5.5 — The join key between graphs is declaration identity

**Decision:** the plan graph and evolution graph are linked by identity, never by feature or category name.

**Why:** names are generated and mutable. Identity is derived from code and stable.

---

## 6. LLM boundary

### 6.1 — Static analysis determines; the LLM narrates

**Decision:** what changed is decided by the parser. The LLM only writes the human-readable description.

**Why:** LLMs hallucinate; parsers don't. The accuracy of the product is the accuracy of its determination step, and that step must be deterministic.

**Verified in:** `llm/prompts.js` — the system prompt states the model's job is only to interpret facts already extracted by static analysis.

---

### 6.2 — The LLM is never used to author contracts that code is verified against

**Decision:** intent used for verification must not be generated by the same class of system that writes the code.

**Why (bootstrap failure):** if one agent writes both the intent annotation and the code in a single pass, they agree by construction. The mismatch signal — the entire point — is eliminated.

**Where the LLM is safe:** evolution labels (nothing is checked against them) and plan-graph drafting (a human reviews before approval).

---

### 6.3 — Comments are not an intent source

**Decision:** `@intent` annotations in comments were built and removed.

**Why:** an agent can delete the annotation in the same edit that breaks the code. Intent that a change can silently erase is not intent.

**Status:** `intents.js` (751 lines) removed from the repo.

---

### 6.4 — When a rule cannot be confident, return `unknown`, not `violated`

**Decision:** `violated` requires positive evidence of absence.

**Why:** two verified false positives. A `HASH_CALLS` whitelist flagged `hashPassword` as violating "password must be hashed." A name-derived rule flagged Express `requireAuth`, which rejects via `res.status(401)` rather than throwing.

**Generalisation:** applies to dependency edges too. A confidently wrong answer is worse than an admitted gap, because the developer acts on it.

---

### 6.5 — Derived intent is a proposal, never a verdict

**Decision:** intent inferred from names, callers, or history must be ratified by a human before it can produce a violation.

**Why:** an unconfirmed proposal that produces violations is an unreviewed rule.

**Non-circular intent sources:** the declaration's **name** (human-authored, survives body rewrites), its **callers** (evidence from code the change didn't touch), its **history** (a long-stable property is load-bearing), its **siblings**.

---

### 6.6 — `session` is reserved for units of developer work

**Decision:** the v0.4 concept of grouping events into one LLM call is named `labelBatch`. The word `session` is reserved exclusively for a v0.5 unit of developer work sealed by commit, idle, or cap.

**Why:** the two concepts are unrelated and would otherwise share a name in the same codebase — a guaranteed source of bugs once Layer 0 exists.

**Current state:** `evolution/events.js` and `commands/evolution.js` still use `session` for the v0.4 meaning. **Rename before any v0.5 code is written.**

---

## 7. Privacy

### 7.1 — Source code never leaves the machine

**Decision:** only extracted facts are sent, and only when labelling is enabled.

```
sent:      calls: [jwt.sign], numbers: [3600] → [7200]
not sent:  the function body, the file, the repository
```

**Why:** this is a structural differentiator. Competing tools clone the codebase to a server. For regulated environments that is a hard blocker, and it is not something they can remove — their architecture depends on it.

---

## 8. Scanning

### 8.1 — Generated and vendored directories are skipped

**Decision:** `node_modules`, `.git`, `dist`, `build`, `coverage`.

**Verified in:** `scanner.js::SKIP_DIRECTORIES`.

---

### 8.2 — Debounce saves; delay unlink

**Decision:** file changes debounce ~300ms. Deletions wait ~400ms before being treated as real.

**Why:** many editors save atomically by writing a temp file and renaming, which surfaces as delete-then-create. Acting on the delete immediately reports every save as a mass deletion.

**Verified in:** `watcher.js:54` (300ms debounce), `watcher/debounce.js`, `watcher/handlers.js:186` (unlink path).

---

### 8.3 — Never reject a watched path when `stats` is undefined

**Decision:** a file-level filter (extension, filename) may only be applied when `stats` confirms the path is a file.

**Why:** chokidar calls the `ignored` predicate **twice** per path — first as `(path)` before it has stat'd anything, then as `(path, stats)`. On the first call a directory guard of the form `stats && stats.isDirectory()` is skipped, execution falls through to the extension test, and the project root — which does not end in `.js` — is ignored. Chokidar then never descends into the tree and **no events ever fire**.

**Verified failure:** the watcher started, printed its ready message, and emitted nothing at all — not even from a catch-all `"all"` handler. Silent, and it looked healthy.

```js
// WRONG — ignores the project root on the stats-less first call
if (!normalizedPath.endsWith(".js")) return true;

// RIGHT — only filter by extension once we know it is a file
if (stats && stats.isFile() && !normalizedPath.endsWith(".js")) return true;
```

**Verified in:** `watcher/filters.js` — guarded by `stats && stats.isFile()`, with a comment explaining the two-call sequence.

**Regression test required:** `shouldIgnore(projectRoot)` with no stats argument must return `false`.

---

### 8.4 — Use `process.exitCode`, not `process.exit()`

**Decision:** set the exit code; let the process end naturally.

**Why:** verified bug — `process.exit()` truncated buffered stdout, so `check` printed nothing and always exited 0.

---

## 9. Portability

### 9.1 — WASM grammars, not native bindings

**Decision:** `web-tree-sitter` with `.wasm` grammar files.

**Why:** native tree-sitter bindings require an ABI rebuild per Electron version. A VS Code extension would break on every editor update.

---

### 9.2 — Everything above the parser is language-agnostic

**Decision:** node type names live in the walk and property extraction. Identity, diff, baseline, events, sessions, evolution, and the LLM layer operate on records only.

**Verified by measurement:**

| Concept | JavaScript | Python |
|---|---|---|
| function | `function_declaration` | `function_definition` |
| class | `class_declaration` | `class_definition` |
| throw | `throw_statement` | `raise_statement` |
| catch | `catch_clause` | `except_clause` |
| call | `call_expression` | `call` |
| await | `await_expression` | `await` |
| binding | `variable_declarator` | `assignment` |
| return | `return_statement` | `return_statement` ✅ |

Only `return_statement` matches — but every concept maps one-to-one. **The fix is a per-language config table, not a rewrite.**

**TypeScript is a superset:** every JS node type appears identically, plus `interface_declaration`, `type_alias_declaration`, `enum_declaration`, `required_parameter`. Existing code works unchanged.

**Known limit:** Go returns errors rather than raising them. It needs a *different property*, not a renamed one. Do not assume the mapping is always one-to-one.

---

## 10. Rejected

| Rejected | Why |
|---|---|
| **Hashing linked code ranges** | Detects change but cannot verify correctness. Verification requires structural re-read. |
| **Git as the detection mechanism** | Git sees commits. Agent drift happens between commits and is tidied away by commit time. (Git *is* used as a session-seal signal — a different job.) |
| **Comment-based intent** | An agent deletes the comment in the same edit. |
| **Filtering noise at extraction** | Destroys unrecoverable data. Filter at read time instead. |
| **Automatic LLM naming** | Spends the user's quota without asking. |
| **LLM deciding significance** | Violates §6.1, and costs money on exactly the events being filtered out. |
| **Metering scans** | Detection and impact are local static analysis with zero marginal cost. Charges for the free thing, leaves the costly thing unpriced. |
| **String literal extraction** | Mostly error messages, reworded constantly. Accepted cost: prompt drift is invisible. |
| **3D graph** | Occlusion is not space. Zoom already solves scale. |
| **Element-level evolution** | Unreadable at scale, and it is the comprehension-tool problem PlanMap deliberately avoids. |
| **Building a coding agent** | Never compete on generation quality. |
| **Custom model router** | Commodity. LiteLLM ships one free. |
| **Semgrep rule reuse** | Their maintained rules library prohibits use in competing products. |
| **Chat interface** | Developers already have an agent open. Near-zero marginal value. |

---

## 11. Open

| Question | Status |
|---|---|
| Should the baseline auto-advance on session seal? | **No** — decided in v0.5. A commit is not an approval. Only `accept` advances it. |
| Should consecutive identical change labels collapse? | **Resolved by session net-delta in v0.5.** Five saves collapse to one entry, first→last, with `eventCount` preserved. |
| Pruning `events.jsonl` | Deliberately not pruned. It is unrecoverable history and one line per event. Revisit only if a real project makes it a problem. |
| Python property semantics | Concepts map, but Go proves the mapping is not universal. Verify per language, do not assume. |

---

*Updated when reality changes — the same discipline the product enforces.*