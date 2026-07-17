# Milestone 1 (Solo, local-first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Companion spec (the detailed contracts — read alongside):** [`docs/superpowers/specs/2026-07-17-planmap-design.md`](../specs/2026-07-17-planmap-design.md). This plan references the spec's interfaces (§4), `.planmap` schema (§5), Impact flow (§6), Auto-map (§7), Drift flow (§8), CLI (§9.4), and acceptance tests (§10) by section/ID instead of re-pasting them. Data-model detail lives in [`planning-phase/05-data-model-and-graph.md`](../../../planning-phase/05-data-model-and-graph.md).

**Goal:** Build the PlanMap **Solo edition** — point at one TypeScript/JavaScript repo → auto-map it → edit a node → get parser-grounded impact → catch drift from approved intent — local-first, no account, BYO-key, runnable via CLI and a local web UI.

**Architecture:** A core-first pnpm+Turborepo monorepo. `@planmap/core` is a pure-TS engine (zero I/O deps) exposing three interfaces — `StorageAdapter`, `Connector`, `LLMProvider`. `@planmap/db` implements `LocalStore` (JSON-canonical `.planmap/` store). `@planmap/connectors` implements the `git` connector via `ts-morph`. `@planmap/ui` is framework-agnostic React (React Flow). `apps/cli` and `apps/web` are thin surfaces over core. The parser decides WHAT is affected; the LLM only narrates WHY (and is optional in M1).

**Tech Stack:** TypeScript 5.x (strict), pnpm workspaces + Turborepo, Vitest, ESLint (flat) + Prettier, zod, ts-morph, `@xyflow/react` + Vite (`@planmap/ui` / `apps/web`), esbuild (`apps/cli`), `@anthropic-ai/sdk` (optional LLM), Node 24 LTS.

## Global Constraints

- **Core-first (hard rule):** no domain logic in `apps/*` or `packages/ui` — only rendering, event marshalling, transport. Enforced by Task C1 (lint rule) + review. Spec §1 (doc 04), litmus in spec §3.
- **Parser decides WHAT; LLM only WHY.** Impact/Drift *decisions* are deterministic (static analysis / hashing); the LLM is a narrator and is optional. Same input ⇒ same affected set every run. Spec §6, §8.
- **Uncertainty always visible.** Every edge/impact item carries `confidence: "certain" | "inferred"`; say "unsure", never guess. Spec §5 (doc 05), §6.
- **Data-as-truth, dual-view.** `.planmap` JSON is canonical; markdown is a derived, one-way projection (JSON always wins). Spec §5.1, doc 05 §6.
- **Seams present even with one impl:** ship `StorageAdapter`/`Connector`/`LLMProvider` interfaces + `entitlements` (Team/Org resolve to `false`) so M2/M3 unlock, not rewrite. Spec §2, §11.
- **M1 language scope:** TypeScript/JavaScript only (ts-morph). No Python/Go/Java/SQL. Spec §2.
- **Zoom = two `level` values** (`constellation`, `feature_space`); no `estate` altitude (v2). Spec §2.
- **Package scope `@planmap/*`; license Apache-2.0; Node `>=22` engines, `packageManager: pnpm@9`+ pinned.**
- **Commits:** one atomic commit per task (staggered). Conventional-commit style (`feat(core): …`, `test(...)`, `chore:`, `ci:`, `docs:`).

## File Structure

```
planmap/
├── package.json                 # private root; workspaces; scripts; packageManager; engines
├── pnpm-workspace.yaml           # packages/*, apps/*
├── turbo.json                    # build/test/lint/typecheck pipeline
├── tsconfig.base.json            # strict compiler options, shared
├── .nvmrc / .npmrc / .editorconfig
├── eslint.config.mjs             # flat config; core-first boundary rule
├── .prettierrc.json
├── vitest.workspace.ts
├── CONTRIBUTING.md               # per-package layout, core-first, commit rules
├── docs/CONVENTIONS.md
├── .github/workflows/ci.yml      # install → typecheck → lint → test → build
├── packages/
│   ├── core/       src/{model,store,connector,llm,depgraph,automap,impact,drift,project,handoff,entitlements}/  + README + tests
│   ├── db/         src/{index,local-store}.ts + tests  (implements StorageAdapter)
│   ├── connectors/ src/{index,git}/  (ts-morph) + tests
│   └── ui/         src/{Graph,nodes,panels,...}.tsx + README
├── apps/
│   ├── cli/        src/index.ts (+ commands/) → `planmap`
│   └── web/        Vite React app + thin localhost server over core
└── examples/
    └── sample-org/ synthetic TS repo w/ known deps + seeded plan/approvals/drift
```

Each `packages/*` and `apps/*` has: `package.json`, `tsconfig.json` (extends base, project refs), `src/`, `README.md`, and colocated `*.test.ts`.

---

## Phase 0 — Repo scaffold & tooling

### Task 1: Root monorepo scaffold
**Files:** Create `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.npmrc`, `.editorconfig`.
**Produces:** a `pnpm install` that succeeds on an empty workspace; `pnpm -w run build` (no-op) works.
- [ ] Root `package.json`: `"private": true`, `"packageManager": "pnpm@9.15.0"`, `"engines": {"node": ">=22"}`, `"workspaces"` via pnpm-workspace, scripts `build/test/lint/typecheck/dev` delegating to `turbo`. `.nvmrc` = `24`. `.npmrc` = `engine-strict=true`, `save-exact=true`. Add a `"volta"` block pinning node/pnpm too (contributor-agnostic).
- [ ] `pnpm-workspace.yaml`: `packages: ["packages/*", "apps/*"]`.
- [ ] `turbo.json`: pipeline for `build` (dependsOn `^build`, outputs `dist/**`), `test`, `lint`, `typecheck`.
- [ ] `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: NodeNext`, `moduleResolution: NodeNext`, `target: ES2022`, `declaration`, `composite` (project refs).
- [ ] Run `pnpm install`; expect success.
- [ ] Commit: `chore: scaffold pnpm + turborepo monorepo`

### Task 2: Lint, format, test tooling
**Files:** Create `eslint.config.mjs`, `.prettierrc.json`, `vitest.workspace.ts`; add devDeps.
- [ ] Install devDeps at root: `typescript`, `turbo`, `vitest`, `eslint`, `@typescript-eslint/*`, `eslint-plugin-import`, `prettier`, `@types/node`.
- [ ] `eslint.config.mjs` (flat): TS recommended + import ordering. Leave a placeholder comment where the **core-first boundary rule** lands in Task C1.
- [ ] `vitest.workspace.ts` globbing `packages/*` + `apps/*`.
- [ ] Add root scripts wire to turbo; `pnpm -w typecheck` passes (no packages yet = trivially green).
- [ ] Commit: `chore: add eslint (flat), prettier, and vitest workspace`

### Task 3: GitHub Actions CI
**Files:** Create `.github/workflows/ci.yml`.
- [ ] Workflow on `push`/`pull_request`: `actions/setup-node@v4` (node 24, `cache: pnpm`), `pnpm/action-setup@v4`, `pnpm install --frozen-lockfile`, then `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build`.
- [ ] Commit: `ci: add GitHub Actions pipeline (typecheck/lint/test/build)`

### Task 4: Contributor docs & conventions
**Files:** Create `CONTRIBUTING.md`, `docs/CONVENTIONS.md`.
- [ ] `CONTRIBUTING.md`: prerequisites (Node 22+ via nvm/Volta/corepack), `pnpm install`, dev loop, commit conventions, PR checklist.
- [ ] `docs/CONVENTIONS.md`: the per-package layout (`src/ + tests + README`), the **core-first rule** (no domain logic in surfaces), provider/connector folder discipline, "uncertainty always visible", "JSON is truth".
- [ ] Commit: `docs: add CONTRIBUTING and repo conventions`

### Task 5: Canonicalize the v6 UX mockup
**Files:** Move `Files/planmap-design-v6.html` → `docs/design-reference/planmap-v6-mockup.html`; delete the stray duplicate; update `docs/design-reference/README.md` (v6 canonical, v5/v3/v2 prior).
- [ ] Read v6; update the design-reference README's "what it demonstrates" to match v6; mark v6 canonical.
- [ ] Commit: `docs: set v6 as the canonical UX reference`

---

## Phase 1 — `@planmap/core` domain model & seams

### Task 6: `@planmap/core` package scaffold
**Files:** Create `packages/core/{package.json,tsconfig.json,src/index.ts,README.md}`.
**Produces:** `@planmap/core` importable; `pnpm --filter @planmap/core build` works.
- [ ] `package.json` name `@planmap/core`, type `module`, exports `./dist/index.js`, scripts build/test/lint/typecheck. `tsconfig.json` extends base, `composite`, `rootDir: src`, `outDir: dist`.
- [ ] `src/index.ts` re-exports submodules (empty for now). `README.md` states core-first responsibility.
- [ ] Commit: `feat(core): scaffold @planmap/core package`

### Task 7: Domain model + zod schemas (`model/`)
**Files:** Create `packages/core/src/model/{node,edge,drift,enums}.ts`, `index.ts`, `model.test.ts`.
**Interfaces — Produces:** `Node`, `Edge`, `LinkedCode`, `Drift` types + `NodeSchema`, `EdgeSchema` (zod) + enums (`Graph`, `Level`, `NodeType`, `Status`, `Origin`, `EdgeType`, `Provenance`, `Confidence`). Field set per **spec §5.2 / §5.3** and doc 05 §2/§3.
- [ ] **Step 1 — failing test** (`model.test.ts`): a valid Node object parses; an invalid `status` throws; `NodeType` accepts the M1 subset (`repo|module|feature|step|element`) and later-tier types exist in the enum; `LinkedCode` requires `path`/`range`/`hash`.
- [ ] **Step 2** — run `pnpm --filter @planmap/core test`; expect FAIL (schemas undefined).
- [ ] **Step 3** — implement zod schemas + inferred types (`z.infer`). Enums as `z.enum([...])`.
- [ ] **Step 4** — run tests; expect PASS.
- [ ] **Step 5** — Commit: `feat(core): node/edge domain model with zod schemas`

### Task 8: The three seams (`store/`, `connector/`, `llm/`)
**Files:** Create `packages/core/src/store/adapter.ts`, `connector/connector.ts`, `llm/provider.ts`, barrels, `seams.test.ts`.
**Interfaces — Produces:** `StorageAdapter`, `Connector`, `LLMProvider`, `ImpactResult`, `Scope/Resource/Artifact/Hash`, exactly per **spec §4** and §6 `ImpactResult`.
- [ ] **Step 1 — failing test:** a hand-written in-memory `StorageAdapter` stub type-checks against the interface; a no-op `LLMProvider` returns `null`-safe. (Compile-time contract test + a tiny runtime stub.)
- [ ] **Step 2** — typecheck fails (interfaces absent).
- [ ] **Step 3** — declare the interfaces verbatim from spec §4 (+ `ImpactResult` from §6). No implementations.
- [ ] **Step 4** — `pnpm --filter @planmap/core typecheck && test` PASS.
- [ ] **Step 5** — Commit: `feat(core): storage/connector/llm seam interfaces`

### Task 9: Entitlements (`entitlements/`)
**Files:** Create `packages/core/src/entitlements/index.ts`, `entitlements.test.ts`.
**Interfaces — Produces:** `type Edition = "solo"|"team"|"org"`, `entitlements(edition): Entitlements` with booleans (`crossRepo`, `approvalsMultiUser`, `driftInCI`, `crossLayer`, `agentDispatch`, `sso`, `audit`). In M1 everything beyond Solo = `false`.
- [ ] **Step 1 — failing test:** `entitlements("solo")` has all team/org flags `false`; the shape is stable.
- [ ] **Step 2** — FAIL. **Step 3** — implement. **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): edition entitlements (Team/Org gated off in Solo)`

---

## Phase 2 — `@planmap/db` (LocalStore)

> **M1 simplification (recorded):** LocalStore is **JSON-canonical** with an **in-memory index** built on load (fast dependency walks / drift scans). SQLite is deferred as a pure optimization behind the same interface — it changes no logical schema and no acceptance test except T-INDEX-REBUILD, which becomes "index rebuilds from JSON files." This keeps M1 lean while honoring "JSON is truth." Recorded as an update to spec §3.3 assumptions.

### Task 10: `@planmap/db` scaffold + `.planmap` layout
**Files:** Create `packages/db/{package.json,tsconfig.json,README.md,src/index.ts}`, `src/paths.ts`.
- [ ] Scaffold package (deps: `@planmap/core`, `zod`). `paths.ts` encodes the `.planmap/` layout from spec §5.1 (`config.json`, `nodes/`, `edges/`, `drift/`, `projections/`).
- [ ] Commit: `feat(db): scaffold @planmap/db package + .planmap layout`

### Task 11: `LocalStore` implements `StorageAdapter`
**Files:** Create `packages/db/src/local-store.ts`, `local-store.test.ts`.
**Interfaces — Consumes:** `StorageAdapter` (core §4), model schemas. **Produces:** `class LocalStore implements StorageAdapter` + `openLocalStore(dir): Promise<LocalStore>`.
- [ ] **Step 1 — failing test** (using a temp dir via `os.tmpdir()`): `putNode` then `getNode` round-trips; nodes persist as `nodes/<id>.json`; `queryNodes({graph,level,type,parent,status})` filters; `getEdges` filters; `listDrifted()` returns drifted; `recordApproval`/`appendAnnotation`/`appendDrift` mutate + persist; `transaction` rolls back on throw; **index rebuild:** delete in-memory index, reopen dir → identical query results (T-INDEX-REBUILD).
- [ ] **Step 2** — FAIL. **Step 3** — implement (read/parse JSON on open → in-memory maps; writes validate via zod then persist one-file-per-record; JSON canonical). **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(db): LocalStore (JSON-canonical .planmap store) implementing StorageAdapter`

---

## Phase 3 — `@planmap/connectors` (git / TypeScript via ts-morph)

### Task 12: `@planmap/connectors` scaffold + git connector shell
**Files:** Create `packages/connectors/{package.json,tsconfig.json,README.md,src/index.ts}`, `src/git/connector.ts`.
**Interfaces — Produces:** `class GitConnector implements Connector` (`id:"git"`, `capabilities:["code"]`) with `discover`/`read`/`fingerprint` (fingerprint = whitespace-normalized hash per spec §8, §3.2 of this plan).
- [ ] **Step 1 — failing test:** `discover` on a fixture dir yields its `.ts` files (respecting `.gitignore`); `fingerprint` is stable and **whitespace-insensitive** (reformat ⇒ same hash); a byte change ⇒ different hash.
- [ ] **Step 2** — FAIL. **Step 3** — implement discover (fast-glob or fs walk + ignore), read (source text), fingerprint (normalize whitespace → sha256 of range). **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(connectors): git/TS connector (discover/read/whitespace-normalized fingerprint)`

### Task 13: ts-morph project + symbol/reference resolution
**Files:** Create `packages/connectors/src/git/ts-project.ts`, `ts-project.test.ts`.
**Interfaces — Produces:** `createTsProject(rootDir): TsFacts` exposing `imports(file)`, `callSites(symbol)`, `referencesTo(symbol)`, `symbolAt(path,range)` — factual, compiler-grade (ts-morph wraps the TS compiler API).
- [ ] **Step 1 — failing test** against a 3-file fixture with known imports/calls: `imports(a.ts)` lists `b.ts`; `referencesTo(fnInB)` includes the call site in `a.ts`.
- [ ] **Step 2** — FAIL. **Step 3** — implement with ts-morph `Project`. **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(connectors): ts-morph project + symbol/reference/import resolution`

---

## Phase 4 — core engine: depgraph, automap, impact, drift, project, handoff, llm

### Task 14: Dependency map (`depgraph/`)
**Files:** `packages/core/src/depgraph/index.ts`, `depgraph.test.ts`.
**Interfaces — Consumes:** `TsFacts` (Task 13) shape via a narrow port type (core stays I/O-free — the connector passes facts in). **Produces:** `buildDepGraph(facts): DepGraph` with `dependentsOf(target): {id, confidence}[]` (walks callers/importers outward).
- [ ] **Step 1 — failing test:** from fixture facts, `dependentsOf(symbolX)` returns exactly the known set, each with `confidence` (`certain` for direct refs). Re-run 5× → identical (determinism).
- [ ] **Step 2** — FAIL. **Step 3** — implement outward graph walk. **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): deterministic dependency map + dependents walk`

### Task 15: Auto-map (`automap/`)
**Files:** `packages/core/src/automap/index.ts`, `placement.ts`, `automap.test.ts`.
**Interfaces — Produces:** `autoMap(facts, store): Promise<void>` — derives Evolution nodes (what exists) + a drafted Plan graph; applies the **semantic placement rule** (doc 05 §7.2 / spec §7.3); granularity cap (workflow-significant; branch >~15 collapses to a summary node).
- [ ] **Step 1 — failing tests (T-MAP, T-PLACEMENT):** running on the fixture yields Constellation feature nodes + Feature-Space step nodes with **no manual YAML**; a change that "extends an existing node" nests as its child; a "login speed" change nests under Login, not a Performance node (semantic, not keyword).
- [ ] **Step 2** — FAIL. **Step 3** — implement derivation + 3-step placement. **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): auto-map (Evolution + drafted Plan) with semantic placement`

### Task 16: Impact Analysis (`impact/`) — the hero
**Files:** `packages/core/src/impact/index.ts`, `risk.ts`, `impact.test.ts`.
**Interfaces — Consumes:** `DepGraph`, `StorageAdapter`, optional `LLMProvider`. **Produces:** `analyzeImpact(nodeId, {store, depgraph, llm?}): Promise<ImpactResult>` per spec §6 pipeline + `ImpactResult` shape.
- [ ] **Step 1 — failing tests (T-IMPACT-WHAT, T-IMPACT-NOINVENT, T-IMPACT-WHY, T-RISK):** with LLM **disabled**, affected set == known dependents, deterministic across 5 runs; **zero invented** dependencies vs. the fixture's known-correct answers (invented ⇒ fail); weak edges marked `inferred`; with LLM enabled the affected **set is byte-identical** (LLM adds only `why`); editing an `auth`-touching node raises `riskFlags:["auth"]`.
- [ ] **Step 2** — FAIL. **Step 3** — implement: resolve `linked_code` → `depgraph.dependentsOf` (WHAT) → risk flags from what the set touches → optional per-item LLM `why` (narration only; never mutates the set). **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): impact analysis (parser decides WHAT, LLM only WHY)`

### Task 17: Drift (`drift/`)
**Files:** `packages/core/src/drift/index.ts`, `drift.test.ts`.
**Interfaces — Consumes:** `StorageAdapter`, connector `fingerprint`. **Produces:** `verify({store, connector, llm?}): Promise<DriftReport>` per spec §8.
- [ ] **Step 1 — failing tests (T-DRIFT-CATCH, T-DRIFT-REFORMAT, T-DRIFT-NOBASELINE, T-DRIFT-ERROR):** out-of-band change vs an **approved** node ⇒ `drifted`, `drift{}` populated, `annotation` preserved; whitespace-only reformat ⇒ stays `implemented`; change to a node with `approved_against:null` ⇒ no drift; deleted file ⇒ `error`.
- [ ] **Step 2** — FAIL. **Step 3** — implement hash re-check → candidate → semantic check vs `approved_against` (LLM narrates issue/cause, doesn't decide) → set status. **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): drift verification vs approved intent (hash + semantic)`

### Task 18: Dual-view projection (`project/`)
**Files:** `packages/core/src/project/index.ts`, `project.test.ts`.
**Interfaces — Produces:** `projectMarkdown(store): Promise<void>` writing `.planmap/projections/**.md` (deterministic, one-way).
- [ ] **Step 1 — failing tests (T-DUALVIEW, T-ONEWAY):** changing a node's `intent` yields a clean one-line markdown diff; hand-editing a projection then re-projecting discards the edit (JSON wins).
- [ ] **Step 2** — FAIL. **Step 3** — implement projector (node → markdown per doc 05 §6 template). **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): dual-view markdown projection (JSON canonical, one-way)`

### Task 19: Agent handoff (`handoff/`)
**Files:** `packages/core/src/handoff/index.ts`, `handoff.test.ts`.
**Interfaces — Produces:** `composeHandoff(nodeId, impact, store): Promise<string>` — a precise, impact-scoped instruction referencing affected files/symbols; **writes no code**.
- [ ] **Step 1 — failing test (T-HANDOFF):** output references the approved node's intent + the affected files/symbols from its `ImpactResult`; contains no code edits.
- [ ] **Step 2** — FAIL. **Step 3** — implement. **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): scoped agent handoff instruction composer`

### Task 20: Anthropic LLM provider (`llm/anthropic.ts`) — optional
**Files:** `packages/core/src/llm/anthropic.ts` (or a small `@planmap/llm`), `llm.test.ts`.
**Interfaces — Produces:** `class AnthropicProvider implements LLMProvider` + `nullProvider` (returns `null` when no key). BYO-key from env; **never metered**.
- [ ] **Step 1 — failing test:** with no key, factory returns `nullProvider` and impact still returns WHAT (WHY = `null`); with a mocked client, `complete()` returns text.
- [ ] **Step 2** — FAIL. **Step 3** — implement (guard on `ANTHROPIC_API_KEY`; wrap `@anthropic-ai/sdk`). **Step 4** — PASS.
- [ ] **Step 5** — Commit: `feat(core): optional Anthropic LLM provider (BYO-key, null when absent)`

---

## Phase 5 — `examples/sample-org` fixture + engine acceptance

### Task 21: Synthetic `sample-org` corpus
**Files:** Create `examples/sample-org/**` — a small but realistic TS repo (e.g., a mini food-ordering app: `browse`, `login` w/ jwt+refresh, `cart`, `checkout`) with a **known dependency structure**, plus a committed `.planmap/` seeded with approved plan nodes and **one seeded drift** (the "remember me" 30-day→24h case) and one `error` node.
- [ ] Author the source files + a `KNOWN.md` documenting the ground-truth dependency edges and expected impact/drift answers (the accuracy oracle).
- [ ] Commit: `test(fixtures): synthetic sample-org corpus with known deps + seeded drift`

### Task 22: Engine acceptance suite against sample-org
**Files:** `packages/core/test/acceptance/*.test.ts` (or per-package) wiring T-IMPACT-*, T-DRIFT-*, T-MAP, T-PLACEMENT against `sample-org`.
- [ ] Wire tests to run the real git connector + core over `sample-org`; assert **zero invented dependencies** and correct drift catches. Run `pnpm -w test`; expect PASS.
- [ ] Commit: `test(core): acceptance suite green against sample-org`

---

## Phase 6 — `apps/cli`

### Task 23: `planmap` CLI
**Files:** Create `apps/cli/{package.json,tsconfig.json,src/index.ts,src/commands/*.ts}`, tests.
**Interfaces — Consumes:** core + `@planmap/db` (LocalStore) + `@planmap/connectors` (git) + provider. **Produces:** commands per **spec §9.4**: `init, map, impact <id>, approve <id>, drift, handoff <id>, project, web`.
- [ ] **Step 1 — failing tests (T-PARITY-SURFACE, T-COLD, T-BYOKEY, T-ENTITLEMENT):** `init`+`map` on `sample-org` with **no network** produce a populated store (WHY absent); `impact <id>` prints the same `ImpactResult` the programmatic API returns; a Team-only command is gated off; BYO-key path adds `why` with no metering/account.
- [ ] **Step 2** — FAIL. **Step 3** — implement CLI (a small arg parser; each command calls the identical core function). `planmap web` boots apps/web. **Step 4** — PASS.
- [ ] **Step 5** — Commit(s): one per command group, e.g. `feat(cli): init/map/impact/approve/drift/handoff/project commands`

---

## Phase 7 — `@planmap/ui` + `apps/web` (use frontend-design; match v6)

### Task 24: `@planmap/ui` renderer
**Files:** Create `packages/ui/**` — React Flow canvas, node/edge renderers keyed by `type/status/confidence`, Constellation↔Feature-Space zoom, lens toggle, Impact panel, drift indicators, node editor. **No domain logic** (emits events, paints returned state).
> **Before building:** invoke the **frontend-design** skill and read `docs/design-reference/planmap-v6-mockup.html` (canonical) so the UI is intentional, not templated — port v6's layout/visual language to React Flow.
- [ ] Component tests (Vitest + Testing Library) for: node renders status/confidence badges; lens toggle filters without moving nodes; impact panel renders an `ImpactResult`; drifted node shows the callout + annotation.
- [ ] Commit(s): `feat(ui): React Flow graph + lens/impact/drift panels (per v6)`

### Task 25: `apps/web` local app
**Files:** Create `apps/web/**` — Vite React app rendering `@planmap/ui`, talking to a thin localhost HTTP layer wrapping the same core functions the CLI calls.
- [ ] **Test (T-PARITY-SURFACE):** web transport returns the identical `ImpactResult` as the CLI for the same store.
- [ ] Commit: `feat(web): local Vite app serving @planmap/ui over core`

### Task 26: First-run example
- [ ] **Test (T-EXAMPLE):** opening `sample-org` shows a populated, drift-annotated map (≥1 seeded `drifted` node with annotation intact).
- [ ] Commit: `feat(web): first-run opens sample-org with a live drift-annotated map`

---

## Phase 8 — polish, boundary enforcement, verify

### Task C1: Core-first boundary lint rule + full green
**Files:** Modify `eslint.config.mjs` (finish the placeholder from Task 2): forbid importing filesystem/db/network/domain modules from `apps/*` and `packages/ui`; forbid domain logic there.
- [ ] **Test (T-CORE-FIRST):** an intentional violation fixture fails lint; the real tree passes.
- [ ] Run the full suite: `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build` — all green. Confirm CI is green on push.
- [ ] Commit: `chore: enforce core-first boundary in lint; full suite green`

---

## Self-Review (done)

- **Spec coverage:** §1 core-first→C1; §2 scope/seams→Tasks 8,9,11; §4 interfaces→Task 8; §5 schema→Tasks 7,10,11; §6 impact→Task 16; §7 auto-map→Task 15; §8 drift→Task 17; §9 CLI→Task 23, web→Tasks 25–26; §10 tests→mapped per task (T-* IDs cited); §11 seams-not-foreclosed→Tasks 8–11,20. Dual-view→Task 18. Handoff→Task 19.
- **Placeholders:** none — every task cites concrete files, interfaces (by spec §), gating T-* tests, and a commit message. Implementation detail that already lives verbatim in the spec is referenced, not re-pasted (DRY, and the spec is a committed sibling doc, not a placeholder).
- **Type consistency:** interfaces are defined once in Task 8 (from spec §4/§6) and consumed by name thereafter (`StorageAdapter`, `Connector`, `LLMProvider`, `ImpactResult`, `DepGraph`).
- **Recorded deviation:** LocalStore is JSON-canonical + in-memory index in M1 (SQLite deferred as a pure optimization) — noted at Phase 2.

## Execution

Given the founder is hands-off for M1 and quality is paramount, execution proceeds **inline in dependency order with TDD** (superpowers:executing-plans), one atomic commit per task, dispatching subagents/`frontend-design` where a task is self-contained (e.g., `sample-org`, the UI). Phases 0–5 (scaffold → engine → fixture) are the make-or-break core and come first; the CLI proves the engine headlessly; the web UI is the on-ramp last.
