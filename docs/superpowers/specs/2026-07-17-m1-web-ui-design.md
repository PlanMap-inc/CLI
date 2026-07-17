# PlanMap M1 Web UI — Design Spec

> **Status:** design spec for Milestone 1, step 7 (the web surface). Consistent with
> the canonical M1 spec (`2026-07-17-planmap-design.md`) and the roadmap
> (`planning-phase/06-roadmap-and-milestones.md`, §2 steps 7–8). The visual and
> interaction baseline is the canonical mockup `docs/design-reference/planmap-v6-mockup.html`.

---

## 1. Goal

Ship the **web surface** of the Solo edition: a local-first browser app that renders
the real `.planmap` graph produced by the M1 engine, and drives the core loop
**map → impact → approve → handoff → drift** entirely from live engine output — no
hardcoded data. It must be provably the *same engine* as the CLI (acceptance **A5**),
and it must satisfy dual-view (**A4**) and cold-start (**A8**).

This is not a rewrite of the engine. The engine, connectors, store, and orchestration
already exist and are green (77 tests). This milestone adds:

1. a shared **engine facade** package both surfaces call,
2. a presentation-only **component library** that ports the v6 mockup, and
3. a local **web app** (API server + SPA) that wires them to a real repo.

## 2. Non-goals (explicitly deferred)

- **Chat / prompt→plan drafting.** The v6 chat panel is roadmap (proactive planning);
  M1 ships the panel shell disabled or hidden, not a working LLM chat.
- **Compile/Implement mutation animations as real writes.** "Implement" maps to the
  scoped **handoff** (PlanMap never writes code). The mockup's optimistic status flip
  is not persisted in M1 beyond `approve`.
- **3D graph.** 2D React Flow only (roadmap defers 3D to v2).
- **Auth, accounts, hosted store, multi-repo.** Solo/local-first only (M2+).
- **Editing the graph structurally in the browser** (add/rename/delete/connect nodes)
  beyond what the engine can persist. M1 web is primarily a *read + impact + approve*
  surface; structural authoring is a fast-follow, not a gate.

## 3. Architecture

Four units, each with one responsibility and a well-defined interface. New packages are
just-in-time internal packages (exports point at `src/*.ts`, no build step for internal
consumers), matching the existing monorepo convention.

```
packages/engine   @planmap/engine   Orchestration facade over connectors+core+db.
                                     Node-only (does I/O). The single brain both
                                     surfaces call. Extracted from apps/cli/src/engine.ts.

packages/ui        @planmap/ui       Presentation-only React components (ports v6).
                                     Browser-only, zero engine/Node imports. Consumes a
                                     plain view-model; emits callbacks. Reusable by the
                                     future VS Code webview.

apps/web           @planmap/web      The local-first app:
                                       server/  a tiny Node HTTP API over @planmap/engine
                                       src/     a Vite React SPA mounting @planmap/ui
```

### 3.1 Why extract `@planmap/engine`

The orchestration in `apps/cli/src/engine.ts` (`initStore`, `mapRepo`, `impactForNode`,
`approveNode`, `driftCheck`, `handoffForNode`, `projectMarkdown`) is the exact code the
web server needs. An app must not import from another app. Extracting it to
`packages/engine` makes **one engine, two surfaces** literally true: the CLI and the web
server both call the identical functions, so their results cannot diverge (**A5**). The
CLI becomes a thin argv wrapper; its acceptance test moves with the engine.

### 3.2 Data contract (the seam)

`@planmap/ui` never imports the engine. It consumes a **view-model** — the same shape
whether the data is real (web) or a fixture (Storybook/tests). This is the seam that lets
the mockup's four hardcoded literals be replaced by engine output without the components
knowing. Defined in `@planmap/ui/model`:

- `PlanGraphView` — `{ nodes: PlanNodeVM[]; edges: EdgeVM[] }` for Constellation and each
  lens's Feature Space. `PlanNodeVM = { id, title, sub?, status, color, x, y, lensTags }`.
- `ImpactView` — `{ title, affected: FileRef[], why, dependencies, risk, confidence }`.
- `EvoTree` — recursive `{ id, title, status, tags, children, detail? }` where
  `detail` carries prompt/summary/linked files/annotation/`drift`.
- `StatusLegend` statuses: `intended | approved | implemented | drifted | error`.

The web app owns the **adapter** that maps engine types (`Node`, `Edge`, `ImpactResult`,
`DriftReport`) to this view-model. Keeping the adapter in the app (not in `ui`) preserves
`ui`'s zero-dependency purity.

### 3.3 The local API server

`apps/web/server` is a minimal Node `http` server (no framework) exposing the engine:

| Method | Route | Engine call | Returns |
|---|---|---|---|
| GET | `/api/graph` | `queryNodes` + `getEdges` | `{ nodes, edges }` (raw engine shape) |
| GET | `/api/impact/:id` | `impactForNode` | `ImpactResult` |
| POST | `/api/approve/:id` | `approveNode` | `{ ok: true }` |
| GET | `/api/drift` | `driftCheck` | `DriftReport` |
| GET | `/api/handoff/:id` | `handoffForNode` | `{ instruction }` |
| GET | `/api/projection` | `projectMarkdown` | `{ markdown }` (A4 dual-view) |
| POST | `/api/map` | `mapRepo` | `{ nodes, edges }` |

The server is pointed at a **target repo** (default: `examples/sample-org`, giving A8
cold-start) via `PLANMAP_REPO` / `--repo`. It runs the same store the CLI would. It never
meters tokens; the LLM provider is BYO-key and resolves to `undefined` in M1 (WHY-prose
absent, not faked). In production it also serves the built SPA so `planmap web` is one
process, fully offline.

### 3.4 Data flow (the core loop, in the browser)

```
Vite SPA ── GET /api/graph ──▶ server ── @planmap/engine ── LocalStore(.planmap) / ts-morph
   │                                                          │
   │◀────────── { nodes, edges } ─── adapter → PlanGraphView ─┘
   │
   ├─ click step node → GET /api/impact/:id → ImpactView → ImpactPanel (parser WHAT; WHY absent w/o key)
   ├─ approve → POST /api/approve/:id → node becomes drift baseline
   ├─ "Implement" → GET /api/handoff/:id → scoped instruction (PlanMap never writes code)
   └─ Evolution view → same /api/graph → EvoTree; drift/error nodes carry callouts
```

## 4. v6 → M1 port map

| v6 mockup element | M1 web implementation |
|---|---|
| App rail (PlanMap / Evolution / Chat) | `AppShell` rail; Chat button present but disabled (roadmap) |
| Plan Graph Constellation ↔ Feature Space | React Flow, two node sets, click-to-zoom via breadcrumb |
| Lens switch (Business/Backend/Security/Database) | filter/relabel Feature Space by lens tag (from `lensTags`) |
| Hardcoded `constellationNodes`/`lensSteps` | `PlanGraphView` from `/api/graph` adapter |
| Impact side panel | `ImpactPanel` from `/api/impact/:id` — real affected files + confidence |
| Canned `impactData` strings | `ImpactResult` (ts-morph WHAT; LLM WHY only if key present) |
| Compile / Implement | Compile = local validation; Implement = `/api/handoff/:id` |
| Evolution collapsible tree + tag filter | `EvolutionTree` from `/api/graph` (evolution graph) |
| Static "drifted"/"error" badges + callouts | real `status` + `drift` from `/api/drift` |
| Status legend | `StatusLegend` (shared component) |
| Dark theme, Space Grotesk/Inter/JetBrains Mono, accent vars | `tokens.css` ported verbatim from v6 `:root` |

## 5. Testing strategy

- **`@planmap/engine`**: the existing end-to-end acceptance test moves here and stays green
  (map → impact oracle → drift → handoff → projection against `examples/sample-org`).
- **`@planmap/ui`**: Vitest + `@testing-library/react` + jsdom for the pure components
  (`StatusLegend`, `ImpactPanel`, `EvolutionTree`, and the view-model — statuses, drift
  callout, tag filtering). React Flow canvas internals are not unit-tested in jsdom; the
  data-transform that feeds it is.
- **`apps/web` server**: start the server against `examples/sample-org`, hit each endpoint,
  assert the graph is non-empty, impact names the known dependents (the sample-org oracle:
  `verifyToken` ← `login` + `checkout`), and `/api/projection` returns markdown. This is the
  web-side proof of A5 (same answers as the CLI) and A4 (dual-view).
- **Cross-platform**: no OS-specific paths; the CI Linux/Windows/macOS matrix runs it all.

## 6. Global constraints (inherited, verbatim)

- **OS-agnostic**: no Windows-specific code or paths; forward-slash normalization; runs on
  Linux/macOS/Windows (CI matrix proves it).
- **Local-first, offline, BYO-key, never metered.** No account, no network except the user's
  own LLM key. LLM absence shows "unsure"/omits WHY — never guesses.
- **Never invent dependencies.** Impact is parser-grounded; confidence always visible.
- **Pinned toolchain**: TypeScript 5.9.x, ESLint 9.x + typescript-eslint 8.x, Vitest 4.x,
  React 18.x, Vite 5.x, `@xyflow/react` (React Flow) 12.x. Zero-warning lint. Prettier-clean.
- **Apache-2.0**, commits use the GitHub noreply email, staggered by concern.

## 7. Build order (staged, each a green committable checkpoint)

- **A.** Extract `packages/engine`; thin the CLI; move the acceptance test. 77 tests stay green.
- **B.** `@planmap/ui` scaffold: `tokens.css`, view-model types, pure components
  (`StatusLegend`, `ImpactPanel`, `EvolutionTree`) + tests.
- **C.** `@planmap/ui` `PlanGraph` (React Flow): Constellation ↔ Feature Space + lens switch + `AppShell`.
- **D.** `apps/web/server`: the Node HTTP API over `@planmap/engine` + endpoint tests.
- **E.** `apps/web` SPA: wire `@planmap/ui` to the API, adapter, sample-org cold-start, dev/build scripts.
- **F.** Root/turbo/CI wiring + READMEs; push `m1-web-ui`.
