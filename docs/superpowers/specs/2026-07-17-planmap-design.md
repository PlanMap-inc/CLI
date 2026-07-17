# PlanMap M1 — Design Spec (Solo edition, local-first)

> **Scope of this document.** This is the implementation-oriented design spec for **Milestone 1 only**: the auto-map + Impact Analysis + Drift engine, shipped as the **Solo edition**, running locally (SQLite/JSON in a `.planmap` store), no account, BYO LLM key, connectors = git/code (TypeScript-JS first). It is deliberately concrete and buildable, not visionary. Team/Org concerns (CloudStore, GitHub-org, cross-layer connectors, agent-execution control plane, governance) are **out of scope** here and referenced only where an M1 seam must not foreclose them.
>
> Consistent with the canonical brief and planning docs 04 (Architecture), 05 (Data Model), and 06 (Roadmap). Terminology is used exactly: Plan Graph, Constellation, Feature Space, Zoom, Lens, Impact Analysis, Evolution Graph, Drift, Node, Edge, `.planmap`, Connector, Storage adapter, Edition, Entitlement.

---

## 1. Goal & success criteria

**Goal.** On a single developer's own TypeScript/JavaScript repository, PlanMap auto-derives a map of what actually exists, lets the developer review/edit intent as an editable graph, tells them (accurately) what an edit will break and why, catches when real code drifts from approved intent, and hands a precise scoped instruction to their own coding agent — all local-first, with no account and BYO LLM key.

**Success criteria (these are the M1 acceptance bar; §10 makes them executable):**

1. **Auto-map with zero manual YAML.** Point at any TS/JS repo → a populated `.planmap` store with Constellation (feature nodes) + Feature Space (step nodes) is produced.
2. **Impact Analysis is parser-grounded.** Editing a Node lists affected nodes/files/functions from **ts-morph static analysis**; the LLM produces only the *why* prose. Every finding carries a confidence flag; the analysis says "unsure" rather than guessing. Same code + same edit ⇒ same affected set, every run (LLM absence does not change WHAT).
3. **Drift catches a real out-of-band change.** A code change made outside PlanMap against an **approved** plan Node flips the linked Evolution Node to `drifted`/`error`, and the stored `annotation` (the *why*) survives.
4. **Dual-view holds.** The `.planmap` store projects to **both** a 2D graph (React Flow / `@xyflow/react`) **and** auto-generated markdown that produces clean, line-scoped git diffs.
5. **Two surfaces, one engine.** Identical results via **web UI** and **CLI**; no domain logic lives outside `@planmap/core`.
6. **Scoped agent handoff.** PlanMap emits a precise, impact-scoped instruction for the user's own agent; it never writes code itself.
7. **Runs cold, offline, keyless-until-LLM.** Fresh clone + `planmap init` works with no account and no network except the user's own BYO LLM call.
8. **Ships with a working example.** `examples/sample-org` opens to a populated, drift-annotated map on first run.

**Non-goals that are still success-relevant:** M1 must deliver value to a developer who *barely touches the graph* (Impact Analysis + Drift stand alone), so the milestone survives even if the graph-vs-markdown bet (planning doc 07 §1) comes back lukewarm.

---

## 2. In scope vs. explicitly out of scope

| Area | **In scope for M1** | **Explicitly OUT of scope (later milestone)** |
|---|---|---|
| Editions | Solo (free, local-first, no account, BYO-key) | Team, Org (M2/M3) |
| Store | `LocalStore` = SQLite + JSON files in `.planmap/` | `CloudStore` (Postgres), hosting, multi-tenant (M2) |
| Storage adapter | The `StorageAdapter` interface + LocalStore impl | CloudStore impl (M2) — but interface must not foreclose it |
| Connectors | git/code connector, TypeScript-JS via ts-morph, single local repo | github-org, postgres, aws, jenkins, bedrock (M2/M3) |
| Languages | TypeScript + JavaScript only | Python, Go, Java, SQL (later) |
| Graphs | Evolution Graph (from code) + Plan Graph (AI-drafted, human-edited) | Cross-layer stitch across DB/cloud/CI (M3) |
| Zoom | Constellation ↔ Feature Space (two `level` values) | `estate` altitude / re-rooting on product/service (v2) |
| Lenses | Business, Backend, Security (view filters) | — |
| Impact Analysis | ts-morph WHAT → LLM WHY, confidence, risk flags | Cross-repo / cross-layer impact (M2/M3) |
| Drift | Hash linked ranges, verify on save + `planmap drift` | Drift-in-CI as a gating check (M2); cross-layer drift (M3) |
| Agent | Scoped instruction handoff (copy/emit) | Dispatch agent to open impact-gated PR (M2); control plane (M3) |
| Surfaces | CLI + local web app | VS Code extension (later); hosted web (M2) |
| LLM | `LLMProvider` interface; Anthropic Claude default; BYO-key, never metered | Bedrock-in-VPC (M3) — but interface must not foreclose it |
| Learn/Guide | Not built in M1 (view + entitlement, layered later) | Learn/Guide mode surface |
| Auth/org/API | None (single user, local) | `apps/api`, identity, RBAC, audit (M2/M3) |
| Approvals | Local approval of a Plan Node (sets the drift baseline) | Multi-user approval workflow, roles (M2) |

**Seam rule (non-negotiable):** M1 builds the `StorageAdapter`, `Connector`, and `LLMProvider` interfaces *even though only one implementation of each ships*, because M2/M3 register more against them rather than rewriting. Entitlement flags exist and gate Team/Org features **off**.

---

## 3. Package / module breakdown for M1

Monorepo, `pnpm` workspaces + Turborepo. Dependency direction strictly inward: `apps/*` → `packages/{connectors,db,ui}` → `packages/core` → nothing internal. **Litmus test in review:** any domain logic in `apps/*` or `packages/ui` is wrong by construction.

```
planmap/
├── packages/
│   ├── core/          @planmap/core        — domain model + engines + interfaces. Zero I/O deps.
│   ├── connectors/    @planmap/connectors  — git/TS connector only in M1.
│   ├── db/            @planmap/db          — StorageAdapter + LocalStore (SQLite/JSON) only in M1.
│   └── ui/            @planmap/ui          — React Flow graph + panels. Framework-agnostic React.
├── apps/
│   ├── web/           Vite + React local web app (Solo). Serves @planmap/ui over a thin local server.
│   └── cli/           `planmap` — esbuild-bundled Node CLI. The CI/agent-scriptable surface.
├── examples/
│   └── sample-org/    Fixture repo(s) with known dependency structure — demo + accuracy regression corpus.
├── planning-phase/    Planning docs.
└── docs/              This spec + generated docs.
```

> **Note on `apps/web` in M1.** The locked stack names Next.js for the *hosted* Team/Org web app (`apps/web`). In M1 (local-first, no server) the same `@planmap/ui` is hosted by a lightweight Vite React app served by a thin localhost process embedded in the CLI (`planmap web`). The UI package is identical; only the transport differs. Next.js/hosting is an M2 concern and is not built in M1.

### 3.1 `@planmap/core` (the brain — all M1 domain logic)

Pure TypeScript, zero dependencies on the DOM, a network, a filesystem path, or a specific DB. `ts-morph` is a dependency of core (it is the parser that decides WHAT), but core reaches code only through the Connector's normalized artifacts, never by reading paths directly.

| Module | Responsibility |
|---|---|
| `model/` | `Node`, `Edge`, `linked_code`, `Drift`, enums (`graph`, `level`, `type`, `status`, `origin`, edge `type`, `provenance`, `confidence`). zod schemas for all of them (§5). |
| `store/` | The `StorageAdapter` interface (see §4). Core depends on this interface only. |
| `connector/` | The `Connector` interface + `IngestionEvent`/`Artifact`/`Resource` shapes + registration. |
| `llm/` | The `LLMProvider` interface (`complete()` / stream). Core never imports a vendor SDK. |
| `depgraph/` | Builds the deterministic dependency map from ts-morph facts (imports, call sites, symbol refs). |
| `automap/` | Derives Evolution Graph nodes/edges from parsed code + drafts the Plan Graph. Applies the Evolution placement rule (§7.3). |
| `impact/` | Impact Analysis pipeline: resolve linked ranges → graph walk (WHAT) → LLM narration (WHY) → `ImpactResult`. |
| `drift/` | Fingerprint linked ranges; `verify()` compares against stored hash + `approved_against`; emits `drift{}`. |
| `project/` | Dual-view projector: JSON store → markdown (deterministic, one-way). |
| `handoff/` | Compose the scoped agent instruction from an approved node + its Impact Analysis. |
| `entitlements/` | Tier flags; in M1 all Team/Org capabilities resolve to `false`. |

### 3.2 `@planmap/connectors` — git/TS connector (M1's single input)

Implements `Connector` with `id: "git"`, `capabilities: ["code"]`.

- `discover(scope)` — enumerate TS/JS source files in the repo (respecting `.gitignore`, `tsconfig` includes).
- `read(resource)` — return the file artifact (source text + parsed metadata via ts-morph project).
- `fingerprint(artifact)` — stable content hash of a code range, **whitespace-normalized** (§8) so a reformat is not flagged as drift.

The connector owns the ts-morph `Project` instance and exposes symbol/reference/import resolution to `depgraph/`. It does **not** decide graph placement — that is core's `automap/`.

### 3.3 `@planmap/db` — StorageAdapter + LocalStore

- `StorageAdapter` interface (defined in `core/store`, implemented here).
- `LocalStore` — backs the interface with SQLite (fast indexed dependency walks / drift scans) **and** the `.planmap/` JSON files (git-committable truth). LocalStore owns keeping the two coherent; **JSON is canonical, SQLite is a derived index** (rebuildable from JSON).
- One migration source (same definitions M2 will apply to the Postgres dialect).

### 3.4 `@planmap/ui` — renderer only

Framework-agnostic React consuming a plain serializable data contract (the same one the web transport marshals). Contains: React Flow (`@xyflow/react`) canvas, custom node/edge renderers keyed by `type`/`status`/`confidence`, Constellation↔Feature Space zoom, lens toggles, the Impact panel, the Drift-flag rendering, and the node editor. **No domain logic** — it emits events (`nodeEdited`, `nodeApproved`, `lensSwitched`, `impactRequested`) and paints returned state.

### 3.5 `apps/cli` — `planmap`

esbuild-bundled Node binary. Commands (§9.4). Hosts core + LocalStore + git connector + LLM provider directly. `planmap web` boots the local web app.

### 3.6 `apps/web` — local web app

Vite React app rendering `@planmap/ui`, talking to a thin localhost HTTP layer that wraps the same core functions the CLI calls. Same engine, same results; transport is `fetch` instead of a direct call.

---

## 4. Interfaces (the M1 seams)

```ts
// core/store — the Storage adapter. M1 ships LocalStore only.
interface StorageAdapter {
  getNode(id: string): Promise<Node | null>;
  putNode(node: Node): Promise<void>;
  queryNodes(q: NodeQuery): Promise<Node[]>;       // by graph/level/type/parent/status
  getEdges(q: EdgeQuery): Promise<Edge[]>;          // by from/to/type/graph
  putEdge(edge: Edge): Promise<void>;
  listDrifted(): Promise<Node[]>;
  recordVerification(nodeId: string, at: string): Promise<void>;
  recordApproval(planNodeId: string, at: string): Promise<void>;
  appendAnnotation(nodeId: string, body: string, at: string): Promise<void>;
  appendDrift(nodeId: string, drift: Drift): Promise<void>;
  transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T>;
}

// core/connector — pluggable ingestion. M1 registers only "git".
interface Connector {
  id: string;                                   // "git" in M1
  capabilities: Capability[];                   // ["code"] in M1
  discover(scope: Scope): AsyncIterable<Resource>;
  read(resource: Resource): Promise<Artifact>;
  fingerprint(artifact: Artifact, range?: Range): Hash;   // whitespace-normalized
}

// core/llm — provider-agnostic, BYO-key, never metered. M1 default = Anthropic.
interface LLMProvider {
  complete(prompt: string, opts?: CompleteOpts): Promise<string>;
  stream?(prompt: string, opts?: CompleteOpts): AsyncIterable<string>;
}
```

Core depends only on these three interfaces. Registration (which connector, which store, which provider) happens at the surface (CLI/web) startup, not in core.

---

## 5. The `.planmap` schema used in M1

M1 uses the full Node/Edge schema from planning doc 05 but only populates the fields reachable with a code-only connector and two zoom levels. Fields for later layers exist in the schema (so the store is forward-compatible) but are `null`/empty in M1.

### 5.1 On-disk layout (git-committed)

```
.planmap/
  config.json            # { version, edition:"solo", connectors:["git"], llm:{provider:"anthropic"} }
  nodes/     node_XXXX.json   # one node per file → clean, line-scoped diffs
  edges/     edge_XXXX.json   # one edge per file
  drift/     node_XXXX.json   # appended drift events
  projections/
    plan/*.md                 # GENERATED (derived, one-way)
    evolution/*.md            # GENERATED (derived, one-way)
```

`config.json.version` pins the schema so a Solo store opens unchanged in later editions. **JSON under `nodes/`,`edges/`,`drift/` is canonical; `projections/` and the SQLite index are derived and JSON always wins.**

### 5.2 Node (M1 subset annotated)

```json
{
  "id": "node_0087",
  "graph": "evolution",             // plan | evolution        (M1: both used)
  "level": "feature_space",         // constellation | feature_space   (M1: both; no estate)
  "type": "element",                // M1 uses: repo|module|feature|step|element. (product/service/endpoint/table/cloud_resource = later)
  "title": "Added refresh tokens",

  "intent": null,                   // PLAN only — the intended behaviour (human-owned)
  "summary": "Issues a long-lived refresh token alongside the JWT; /auth/refresh exchanges it.",  // EVOLUTION only — from code
  "prompt": "Add refresh token support so users stay logged in",  // optional provenance

  "status": "implemented",          // intended | approved | implemented | drifted | error
  "origin": "ai_generated",         // ai_generated | manually_added | ai_edited_by_human
  "parent": "node_0084",            // containment spine (single parent)
  "edges_out": ["node_0091"],       // ordered flow at this altitude
  "lens_tags": ["security", "backend"],   // metadata only — never moves a node

  "linked_code": [
    { "path": "src/auth/jwt.ts",     "range": [88, 141], "hash": "c4e2a1", "current_hash": "c4e2a1" },
    { "path": "src/auth/refresh.ts", "range": [1, 62],   "hash": "7b90fd", "current_hash": "7b90fd" }
  ],

  "depends_on": ["node_0084"],       // cached rollup of depends_on edges (derived)
  "depended_on_by": ["node_0091"],   // cached inverse (derived)
  "approved_against": "node_p084",   // PLAN node id this Evolution node is drift-checked against (null until approved)

  "annotation": "7-day refresh window — matches the weekly repeat-order pattern, not daily.",
  "drift": null,                     // populated only when status = drifted

  "created_at": "2026-07-06T17:48:00Z",
  "last_verified": "2026-07-16T09:00:00Z"
}
```

`intent` (Plan) and `summary` (Evolution) are **separate fields on purpose** — drift is exactly the delta between them; collapsing them erases the comparison that is the product.

### 5.3 Edge (M1 subset)

```json
{
  "id": "edge_0311",
  "type": "calls",                  // M1 uses: imports | calls | depends_on. (deploys/reads/writes = later cross-layer)
  "from": "node_0087",
  "to":   "node_0084",
  "graph": "evolution",
  "provenance": "static_analysis",  // M1: static_analysis | manual
  "confidence": "certain"           // certain | inferred — always rendered visibly distinct
}
```

**Hard rule (inherited from Impact Analysis):** edges are decided by the **static parser, never the LLM**. Every edge carries `provenance` + `confidence`; `inferred` edges render distinctly.

### 5.4 Logical tables (LocalStore materializes these as SQLite + JSON)

`nodes`, `edges`, `code_links` (normalized `linked_code[]`), `annotations` (append-only history of the *why*), `approvals` (what makes a node the drift baseline), `drift_events`. Identical column set to what M2's CloudStore will use — schema parity is a tested contract (§10, T-PARITY), not an assumption.

### 5.5 Node states

`intended` (authored, no code) → `approved` (reviewed; becomes a drift baseline) → `implemented` (built, linked, `hash == current_hash`, matches intent) → `drifted` (linked code changed, no longer matches approved intent) / `error` (linked code missing/broken/won't parse).

---

## 6. Impact Analysis flow (the hero) — ts-morph WHAT → LLM WHY

**The single most important rule in the product:** a static parser (ts-morph) decides **WHAT** is affected; the LLM **ONLY** explains **WHY** in plain language and never decides what is affected. Confidently-wrong impact analysis is worse than no tool.

Pipeline, all in `@planmap/core/impact` (steps 1–3 have **no LLM in the causal path**):

```
 Node edited in Plan Graph
        │
 (1) Resolve linked_code ranges        Node → [{path, range}] from the .planmap store.
        │
 (2) ts-morph static analysis          Via the git connector's Project: parse imports, call sites,
     builds the dependency map         symbol references. Build: which symbols call which,
        │                              which files import which. FACTUAL, deterministic.
        │
 (3) Deterministic graph walk          From the changed ranges, walk dependents outward →
     "WHAT is affected"                affected nodes / files / functions. Attach per-edge
        │                              confidence (certain = direct ref; inferred = weaker signal).
        │
 (4) LLM narration (per finding)       For each ALREADY-DECIDED affected item, LLMProvider writes
     "WHY, in plain language"          one causal sentence: "login.ts calls verifyToken(), whose
        │                              signature changes." Cannot add/remove/re-rank findings.
        │
 (5) ImpactResult                      { affected[], why[], dependencies{depends_on, depended_on_by},
     (uncertainty always visible)        risk_flags[], confidence per item }
```

- **Determinism:** same code + same edit ⇒ same affected set, every run. Unit-tested against `examples/sample-org` (§10). If the LLM is unavailable, Impact Analysis still returns the correct WHAT — it simply lacks the narrated WHY.
- **Risk flags** are raised by the parser/rules from what the affected set *touches* — anything matching auth, payments, user data, or migrations — not by asking the LLM to assess risk.
- **Confidence** is emitted by the parser (direct reference vs. inferred), not self-assessed by the model. "Say unsure rather than guess" is enforced structurally.
- **`ImpactResult` shape (contract for UI + CLI):**

```ts
interface ImpactResult {
  editedNode: string;
  affected: Array<{
    nodeId?: string; path: string; symbol?: string;
    kind: "node" | "file" | "function";
    confidence: "certain" | "inferred";
    why: string | null;            // LLM narration; null if LLM unavailable
  }>;
  dependencies: { depends_on: string[]; depended_on_by: string[] };
  riskFlags: Array<"auth" | "payments" | "user_data" | "migrations">;
}
```

---

## 7. Auto-map & the Evolution placement rule

### 7.1 Auto-map (no manual YAML)

`automap/` consumes the git connector's parsed artifacts and derives the **Evolution Graph** (what exists) plus a drafted **Plan Graph** (AI-suggested intent the human then edits). Feature nodes populate the Constellation; workflow-significant step/element nodes populate Feature Space. Granularity is **workflow-significant only** — a form field or submit button qualifies if the workflow depends on it; styling, layout divs, and internal variables do not. Below feature level, a branch past ~15 nodes collapses to a summary node.

### 7.2 Constellation vs. the spine in M1

M1 has a single local repo, so the Constellation is rooted on that repo and shows its **features**; clicking a feature re-roots into its **Feature Space** (steps). The `level` enum stays at two values (`constellation`, `feature_space`); the `parent` spine can still record `repo`/`module` above features, but there is no third rendered altitude (`estate` is v2).

### 7.3 The Evolution placement rule (semantic, never keyword)

When a new Evolution node is derived, its position is decided by what the change is *about*:

| Step | Question | Placement |
|---|---|---|
| 1 | Does it **extend or fix** an existing node? | child of that node |
| 2 | Does it belong to an existing **feature**? | new child under that feature |
| 3 | Has nobody touched this capability before? | new top-level node |

`lens_tags` record that a node is `backend`/`frontend`/`security` — but tags are metadata and **never** determine position. "Improve login speed" nests under **Login**, not a "Performance" node.

---

## 8. Drift flow

**Drift = an APPROVED Plan-Graph node's intent no longer matches the reality of its linked code.** Measured against an explicitly approved plan node (`approved_against`); the stored `annotation` preserves the *why*. This is stronger than generic architectural-erosion detectors: it is deviation from *a specific human-approved intent with recorded rationale*.

Mechanism in `@planmap/core/drift` (storage via `@planmap/db`):

```
 Each implemented node stores per linked range: { path, range:[start,end], hash }
   hash = fingerprint(whitespace-normalized code at approval time)   ← connector.fingerprint()

 verify()  (on save, and on `planmap drift`):
   for each linked_code range:
       current_hash = fingerprint(read(path, range))
       if current_hash != hash:
           → CANDIDATE drift (mechanical: something changed)
           → semantic check against approved_against Plan node's intent:
                still matches intent?  → re-verify, update hash, keep `implemented`
                diverges from intent?  → status = drifted; write drift{}
       if range missing / file gone / won't parse:  → status = error
   update last_verified
```

- **The detector is a hash comparison — deterministic, cheap, no LLM.** The *decision* that something changed is a byte comparison; the LLM's only role is narrating the already-detected `issue` and `likely_cause` on the `drift{}` record.
- **Whitespace-normalized** hashing kills the cheapest false positives (reformats). A behavior-preserving refactor can still trip the candidate check → the semantic step against `approved_against` is what prevents a confidently-wrong flag. `drifted` is only written after that step confirms.
- **No approved baseline ⇒ no drift.** A change with no `approved_against` is just unmapped reality, not drift. This is why `approvals` is a first-class table.
- **M1 triggers:** on save (the local web app / editor hook) and the `planmap drift` CLI command. Drift-in-CI as a *gate* is M2.

`drift{}` record (populated only when `status = drifted`):

```json
"drift": {
  "detected_at": "2026-07-15T14:22:00Z",
  "file": "src/auth/login.ts",
  "issue": "Session lifetime is now hardcoded to 24h. The 30-day extension this node describes no longer exists.",
  "likely_cause": "Modified outside PlanMap — no approved plan node corresponds to this change."
}
```

---

## 9. The web-UI surface (M1)

Local web app (`apps/web`, Vite + React) rendering `@planmap/ui`, served by `planmap web` on localhost. The UI is a **pure renderer**; every action round-trips to core.

**UX reference (baseline, not the product).** The interaction model and visual language for this surface are baselined on the v5 ideation mockup at [`docs/design-reference/planmap-v5-mockup.html`](../../design-reference/planmap-v5-mockup.html): the icon rail, Constellation↔Feature Space zoom, the Business/Backend/Security lens switch, the Impact side-panel, and the Evolution tree with drift callouts. That mockup is a **shell with hardcoded data**; M1 keeps its interaction model and replaces the fake data with the real auto-map + parser-grounded Impact Analysis + Drift, adds the dual-view markdown projection and CLI parity, and wires the storage/connector/LLM seams. Further polish, additional views, and the non-technical Stakeholder view are roadmap, not M1.

### 9.1 The core loop (this is the product, demoable end-to-end)

```
open map → edit a Node → Impact Analysis fires → review WHAT + WHY + risk + confidence
   → approve (sets drift baseline) → scoped agent handoff (copy/emit instruction)
   → [developer's own agent implements] → Drift re-verifies on next save/run
```

### 9.2 Views

- **Constellation** — feature nodes for the repo. Node color/shape keyed by `type`; badge keyed by `status` (`intended`/`approved`/`implemented`/`drifted`/`error`).
- **Feature Space** — step/element nodes inside a clicked feature; branch >~15 nodes collapses to a summary node.
- **Zoom** — click a Constellation node to fly into its Feature Space; fly out to return. Two altitudes only.
- **Lens toggle** — Business / Backend / Security. A lens filters `lens_tags` and re-picks which edges to draw; it **never moves a node or changes altitude**.
- **Impact panel** — on node edit, shows affected items, the LLM *why* per item, dependencies (needs / needed-by), risk flags, and confidence (certain vs. inferred rendered visibly distinct). Uncertainty is always visible.
- **Drift indicators** — `drifted`/`error` nodes are visibly flagged; opening one shows the `drift{}` issue + likely cause with the `annotation` still attached.
- **Node editor** — add/edit/delete nodes and edges, drag/reparent, annotate any node with the *why*, undo/redo. Manually-added nodes are `intended` (no code yet) and `origin: manually_added`; AI never silently overwrites a human-authored node.

### 9.3 UI ↔ core contract

The UI emits serializable events (`nodeEdited`, `nodeApproved`, `lensSwitched`, `zoomChanged`, `impactRequested`, `annotationAdded`, `handoffRequested`) and paints returned state. The exact same data contract is used whether transport is `fetch` (web) or a direct call (CLI) — this is what guarantees "two surfaces, one engine."

### 9.4 CLI parity (`apps/cli`)

Every headless capability of the loop, same engine:

| Command | Does |
|---|---|
| `planmap init` | Create `.planmap/` (LocalStore), write `config.json`, no account. |
| `planmap map` | Run the git/TS connector + auto-map → populate Evolution + drafted Plan graphs. |
| `planmap impact <nodeId>` | Run Impact Analysis; print affected + why + risk + confidence (JSON or text). |
| `planmap approve <nodeId>` | Approve a Plan node → set the drift baseline. |
| `planmap drift` | Re-hash linked ranges, verify vs. approved baselines, report `drifted`/`error`. |
| `planmap handoff <nodeId>` | Emit the scoped agent instruction for the user's own agent. |
| `planmap project` | Regenerate the markdown projection from JSON. |
| `planmap web` | Boot the local web app. |

CLI and web must return **identical** results for `impact`/`drift` on the same store — the parity is a test (§10, T-PARITY-SURFACE).

---

## 10. Acceptance tests

Concrete, runnable tests an implementation-planning step can execute against. The permanent regression corpus is `examples/sample-org` — fixture repo(s) with a **known** dependency structure and pre-seeded approved plan nodes, so impact accuracy and drift are measured on every commit.

### 10.1 Engine tests (core, milliseconds, no UI)

| ID | Test | Pass condition |
|---|---|---|
| **T-MAP** | Run `automap` on `examples/sample-org`. | Constellation feature nodes + Feature Space step nodes produced with **no manual YAML**; placement follows the 3-step rule (a known "improve login speed" change nests under Login, not a Performance node). |
| **T-IMPACT-WHAT** | Edit a fixture node whose symbol is referenced by 3 known dependents; run Impact Analysis with the LLM **stubbed/disabled**. | Affected set == the known 3 dependents (no more, no fewer). Re-run 5× → identical set every time (determinism). |
| **T-IMPACT-NOINVENT** | Across the sample-org accuracy corpus, compare affected sets to the known-correct answers. | **Zero invented dependencies.** Missing edges are acceptable and marked; invented edges fail the build. Weak-signal edges are marked `inferred`, not `certain`. |
| **T-IMPACT-WHY** | Run Impact Analysis with the LLM enabled. | Each affected item gets a one-sentence `why`; the affected **set is byte-identical** to the LLM-disabled run (LLM changed WHY, not WHAT). |
| **T-RISK** | Edit a fixture node touching an `auth` code path. | `riskFlags` includes `auth`; a node touching none raises no flags. |
| **T-DRIFT-CATCH** | Approve a fixture plan node; mutate its linked code out-of-band so it diverges from intent; run `verify()`. | Node flips to `drifted`; `drift{}` populated; the pre-existing `annotation` is unchanged. |
| **T-DRIFT-REFORMAT** | Reformat (whitespace-only) a linked range; run `verify()`. | Node stays `implemented` (whitespace-normalized hash unchanged) — no false positive. |
| **T-DRIFT-NOBASELINE** | Mutate code linked to a node with `approved_against: null`; run `verify()`. | No drift raised (unmapped reality, not drift). |
| **T-DRIFT-ERROR** | Delete a file referenced by a linked range; run `verify()`. | Node flips to `error`, not `drifted`. |
| **T-PLACEMENT** | Derive a new Evolution node for a change that extends an existing node. | Node placed as a child of that node (rule step 1), tags recorded but not used for placement. |

### 10.2 Store & projection tests

| ID | Test | Pass condition |
|---|---|---|
| **T-DUALVIEW** | Change a node's `intent` from "7-day" to "30-day"; run `project`. | Generated markdown diff is a clean, one-line, line-scoped change; JSON is canonical. |
| **T-ONEWAY** | Hand-edit a `.planmap/projections/*.md` file; run `project`. | The hand-edit is discarded / re-projected from JSON (JSON wins). |
| **T-INDEX-REBUILD** | Delete the SQLite index; reopen the store. | Index rebuilds from JSON with identical query results (JSON is truth, SQLite is derived). |
| **T-PARITY** | Round-trip the store through the M2-shaped logical schema (LocalStore export → import). | Lossless: same nodes/edges/annotations/approvals/drift, byte-for-byte semantics (guards the Solo→Team promise). |

### 10.3 Surface & packaging tests

| ID | Test | Pass condition |
|---|---|---|
| **T-PARITY-SURFACE** | Run `planmap impact <n>` (CLI) and request the same via the web transport, same store. | Identical `ImpactResult`. |
| **T-COLD** | Fresh clone → `planmap init` → `planmap map` with **no network** (LLM disabled). | Auto-map + Impact WHAT + Drift all work offline; only the WHY prose is absent. No account required at any point. |
| **T-BYOKEY** | Configure a BYO LLM key; run Impact Analysis. | LLM `why` populated; **no token metering, no PlanMap-side account, no code/keys leave the machine** beyond the user's own provider call. |
| **T-HANDOFF** | `planmap handoff <approvedNodeId>`. | Emits a precise, impact-scoped instruction referencing the affected files/symbols; PlanMap writes **no code** itself. |
| **T-ENTITLEMENT** | Attempt a Team/Org capability (e.g. drift-in-CI gate, cross-repo). | Gated **off** by entitlement flag in Solo; interfaces present but no implementation invoked. |
| **T-EXAMPLE** | Open `examples/sample-org` on first run. | Shows a populated, drift-annotated map (at least one seeded `drifted` node with its `annotation` intact). |
| **T-CORE-FIRST** | Static check / review gate on `apps/*` and `packages/ui`. | No domain logic outside `@planmap/core` (surfaces contain only rendering, event marshalling, transport). |

### 10.4 The make-or-break precondition (Build step 0)

Before product code: take 3–4 real architectural changes already made to a known repo and, on paper, confirm Impact Analysis *could* have listed everything each affected, correctly, beforehand. If it could not, the engine is not yet possible and no UI should be built. This gate is encoded as the seed of the `examples/sample-org` accuracy corpus that T-IMPACT-* run against.

---

## 11. What M1 deliberately does not foreclose

M1 ships one implementation of each seam but must leave the door open, at **zero added Solo cost**:

- **Storage adapter** — LocalStore now; CloudStore (Postgres) is an M2 swap behind the identical interface + logical schema (validated by T-PARITY).
- **Connector interface** — git/TS now; github-org / postgres / aws / jenkins / bedrock register against the same interface in M2/M3 without core changes.
- **LLMProvider** — Anthropic default now; Bedrock-in-VPC is an M3 provider behind the same interface; BYO-key and never-metered are invariant across all editions.
- **Entitlements** — present and resolving Team/Org capabilities to `false`, so M2/M3 unlock rather than rebuild.
- **Two-value `level` enum** — Constellation/Feature Space only; the `estate` altitude is a v2 field, not built here.

The one-sentence version: **M1 is the auto-map + parser-grounded Impact Analysis + plan-anchored Drift loop on one developer's own TypeScript repo, local-first and free — the narrowest slice that tests all three of PlanMap's core bets, built on interfaces that make Team and Org an unlock, not a rewrite.**
