# PlanMap — Architecture

> **Scope.** This document specifies *how PlanMap is built*: the monorepo, the six subsystems, the two mechanisms that let one codebase run both local-first (Solo) and hosted (Team/Org) — the **Storage adapter** and the pluggable **Connector** interface — and the internal architecture of the three engines that carry the product (Impact Analysis, Drift, LLM). It is downstream of the product decisions in the canonical brief; it does not re-litigate them. Where a choice is load-bearing, the rationale is stated inline.

**Architectural north star:** PlanMap is a planning + governance + comprehension layer that sits **one layer above** coding agents. It never writes code. Everything below serves one property that predecessors died without — **freshness-by-construction**: the map auto-populates and re-verifies from ground truth (real code, schema, cloud, CI), never from humans hand-filling a catalog. Backstage catalogs are "never completed," ServiceNow CMDB decayed into "stale, untrustworthy data" over 20 years, and CodeSee — a funded "map your whole codebase" startup — shut down. The architecture's job is to make the map incapable of rotting.

---

## 1. Core-first principle

**The rule: no feature is ever built into a surface. Every capability lands in `@planmap/core` first, then a thin surface renders it.**

`core` is pure TypeScript with zero dependencies on VS Code, the DOM, Next.js, a network, or a specific database. It owns the domain model (`Node`, `Edge`, `.planmap`), the Impact Analysis engine, the Drift engine, the graph-derivation logic, and the interfaces (Storage adapter, Connector, LLM provider) that everything else plugs into. A surface — the VS Code extension host, the web app, the CLI, the API — is a *transport and a renderer*, nothing more. It marshals input to core, calls a core function, and paints the result.

**Why this is non-negotiable for PlanMap specifically:**

| Force | Consequence if core-first is violated |
|---|---|
| **Three editions, one engine** | Solo (local), Team (hosted), Org (VPC) must be the *same* logic. If impact analysis lives in the VS Code extension, the CLI and CI can't run it, and Team/Org re-implement it — three subtly different answers to "what breaks." Trust dies on the first discrepancy. |
| **Four surfaces** (CLI, VS Code, web, CI) | Each surface would otherwise re-derive drift slightly differently. |
| **Accuracy is the moat** | Impact/drift correctness must be unit-testable *without* spinning up VS Code, a browser, or Postgres. Core is testable in milliseconds against fixture repos. |
| **Neutrality is the positioning** | Agent-/IDE-agnostic means the brain cannot be welded to one editor. |

**Litmus test used in review:** if a pull request adds domain logic to `apps/*` or `packages/ui`, it is wrong by construction. Surface packages may contain only rendering, event marshalling, and transport glue.

---

## 2. Monorepo layout

One repository, `pnpm` workspaces + Turborepo. Packages are the reusable engine; apps are the surfaces that consume them.

```
planmap/
├── packages/
│   ├── core/          @planmap/core        — domain model, impact engine, drift engine,
│   │                                          graph derivation, all interfaces. Zero I/O deps.
│   ├── connectors/    @planmap/connectors  — Connector implementations (git, github-org,
│   │                                          postgres, aws, jenkins, bedrock-usage).
│   ├── db/            @planmap/db          — Storage adapter: LocalStore (SQLite/JSON) +
│   │                                          CloudStore (Postgres), one schema, one interface.
│   └── ui/            @planmap/ui          — React Flow graph components, lens rendering,
│                                             impact/drift panels. Framework-agnostic React.
├── apps/
│   ├── api/           Node/HTTP service (Team/Org). Wraps core behind auth + REST/RPC.
│   ├── web/           React app (@planmap/ui): Vite local app for M1/Solo; Next.js for hosted Team/Org (M2+).
│   ├── cli/           `planmap` — esbuild-bundled Node CLI. The CI/agent-scriptable surface.
│   └── vscode/        VS Code extension (later milestone). Extension host ↔ webview.
├── examples/
│   └── sample-org/    A multi-repo fixture "product" — the demo + the impact/drift test corpus.
├── planning-phase/    These planning documents.
└── docs/              Generated + authored documentation.
```

**Dependency direction is strictly inward.** `apps/*` depend on `packages/*`; `packages/{connectors,db,ui}` depend on `packages/core`; `core` depends on nothing internal. Turborepo caches builds/tests along this graph so a change in `core` re-tests its dependents and nothing else.

**`examples/sample-org` is load-bearing, not decoration.** Phase 0 of the build order is a paper test of whether impact analysis *could* have correctly predicted real architectural changes. `sample-org` is the executable version of that test: a fixed corpus of repos with known dependency structure, against which impact accuracy and drift detection are measured on every commit. Accuracy is the moat, so it gets a permanent regression harness.

---

## 3. The six subsystems

PlanMap is six subsystems. The first ingests reality; the middle three turn it into a drift-checked graph; the last two expose and act on it. The clean seam is: **subsystems 1–3 are edition-independent core logic; 4–6 gain capability by edition entitlement.**

| # | Subsystem | Package/App home | Responsibility | Edition |
|---|---|---|---|---|
| 1 | **Ingestion + Connectors** | `@planmap/connectors` | Pull ground truth: read code (git), and later org repos, DB schema, cloud config, CI. Normalize into core's ingestion events. | Solo: git only. Team/Org: register more. |
| 2 | **Graph store** | `@planmap/db` | Persist the `.planmap` — Plan Graph, Evolution Graph, nodes, edges, annotations, linked-code hashes. LocalStore or CloudStore behind one interface. | All (adapter swaps). |
| 3 | **Analysis engine** | `@planmap/core` | The brain: static-analysis dependency map, Impact Analysis (WHAT), Drift verification (hashing), Evolution-Graph derivation, LLM orchestration (WHY). | All. |
| 4 | **Web app** | `apps/web` + `@planmap/ui` | Render the Plan Graph (Constellation/Feature Space, Business/Backend/Security lenses), impact panels, drift flags, Learn/Guide mode. | All (localhost or hosted). |
| 5 | **Agent execution** | `@planmap/core` (control) + `apps/api` (dispatch) | Hand a precise, scoped instruction to the user's agent; on Team/Org, dispatch an agent to open an impact-gated PR and re-verify drift. | Solo: local handoff. Team/Org: dispatch + control plane. |
| 6 | **Auth / org / API** | `apps/api` | Identity, org/RBAC, entitlements, audit logs, the network boundary. | Team/Org only (Solo has no account). |

**The seam is the whole trick.** Subsystem 3 — the analysis engine — is identical bytes whether it runs inside the Solo CLI on a laptop or inside the Org API in a customer VPC. What changes across editions is *which connectors feed it* (subsystem 1), *where it persists* (subsystem 2), and *what governance wraps it* (subsystems 5–6). This is why the brief insists on "one engine, three editions": the differentiated, defensible logic is written once.

**On buy-vs-build across the six:** subsystem 1 (ingestion) is deliberately thin — it *borrows* funded ingestion (GitHub API, CloudQuery/Steampipe, AWS Config, Jenkins API) rather than out-integrating specialists who have raised $30M+ to do only that (CloudQuery ~$34.5M; Firefly ~$29.5M). Subsystems 2–3 and 5 — the drift-graph and the agent-execution brain — are where PlanMap *builds*, because that cross-layer stitch is the whitespace no incumbent owns.

---

## 4. The Storage adapter — one codebase, local-first *and* hosted

**The problem it solves.** Solo must run with no account, no server, no DB daemon — SQLite/JSON in a `.planmap` store on the developer's disk. Team/Org must run a hosted central store (or self-host/VPC) with concurrent writers, org-wide queries, and audit. If these were two data layers, they would drift apart and every feature would be built twice. They are not. They are one interface with two implementations.

```
                       ┌───────────────────────────────┐
   @planmap/core  ───▶ │   StorageAdapter (interface)   │
   (never sees SQL     │  getNode / putNode / query     │
    or a file path)    │  listDrifted / appendAudit …   │
                       └───────────────┬───────────────┘
                            ┌───────────┴───────────┐
                     ┌──────▼──────┐          ┌──────▼───────┐
                     │  LocalStore │          │  CloudStore  │
                     │ SQLite/JSON │          │   Postgres   │
                     │  (Solo)     │          │ (Team / Org) │
                     └─────────────┘          └──────────────┘
                        IDENTICAL LOGICAL SCHEMA, ONE MIGRATION SOURCE
```

**Contract.** `core` depends only on the `StorageAdapter` interface — a set of async methods over the domain types (`getNode`, `putNode`, `queryNodes`, `getEdges`, `listDrifted`, `recordVerification`, `appendAudit`, transaction scope). It never issues SQL and never touches a filepath. The two implementations satisfy the same interface and the same *logical* schema; only the physical layer differs:

| | **LocalStore** | **CloudStore** |
|---|---|---|
| Backing | SQLite file (+ JSON projection) in the `.planmap` store | Postgres |
| Edition | Solo (default), Team/Org self-host dev | Team (hosted), Org (hosted or VPC/on-prem) |
| Concurrency | Single-writer, process-local | Multi-writer, row-level, org-scoped |
| Account | None | Identity + org + RBAC (subsystem 6) |
| Migrations | Same migration definitions, applied to SQLite dialect | Same definitions, Postgres dialect |

**Why SQLite *and* JSON, not one or the other.** The brief's "data-as-truth, DUAL-VIEW" decision requires the `.planmap` to be the single source of truth projected to **both** a 2D graph **and** auto-generated markdown (clean git diffs, PR review, interop with Spec Kit / OpenSpec). SQLite gives fast indexed queries (dependency walks, drift scans) locally; the human-reviewable, git-committable projection is JSON/markdown. LocalStore owns keeping the two coherent. This also delivers the moat's portability property: the store is plain, inspectable, git-native — a *trust* advantage over hosted black boxes (and, honestly, weak lock-in, which is fine: the moat is behavioral — accumulated, reused annotations — not proprietary format).

**Why this earns the edition strategy.** Because `core` is written against one interface, "runs on a laptop with no account" and "runs in a customer VPC serving an org" are a *deployment* choice, not a fork. Same web UI, same engine, same schema, whether the URL is `localhost` or a hosted tenant. Adding Team is: swap LocalStore → CloudStore, turn on subsystem 6. Nothing in the brain changes.

---

## 5. The pluggable Connector interface — and the buy/borrow-ingestion stance

**A Connector's one job: turn some external reality into normalized ingestion events that core folds into the Evolution Graph and links to Plan-Graph nodes.** Core defines the interface; each Connector implements it; the active edition decides which are *registered*. Solo loads only the git/code Connector; Team/Org register more via entitlement.

```ts
interface Connector {
  id: string;                       // "git" | "github-org" | "postgres" | "aws" | "jenkins" | "bedrock"
  capabilities: Capability[];       // code | schema | cloud | ci | usage
  discover(scope): AsyncIterable<Resource>;   // enumerate what exists (repos, tables, resources…)
  read(resource): Promise<Artifact>;          // fetch the ground-truth artifact
  fingerprint(artifact): Hash;                // stable hash for drift on this layer
}
```

| Connector | Layer | Borrowed source (input) | Edition |
|---|---|---|---|
| **git / code** | code | Local git + ts-morph parse (TypeScript/JS first) | Solo, Team, Org |
| **github-org** | code (multi-repo) | GitHub API (org, repos, PRs) | Team, Org |
| **postgres** | data / schema | Postgres catalog / schema introspection | Org (Team: basic) |
| **aws** | cloud | AWS Config + CloudQuery/Steampipe as inputs | Team (basic), Org (full) |
| **jenkins** | CI | Jenkins API | Team, Org |
| **bedrock** | LLM usage | Bedrock usage/invocation metadata | Org |

**The buy/borrow stance, stated plainly.** PlanMap **borrows ingestion, builds the brain.** Ingestion is a maintenance treadmill — CloudQuery and Steampipe exist *purely* to maintain 150+ provider integrations, and they are funded companies. A tiny team cannot out-integrate them and must not try. So Connectors are thin adapters over existing funded sources (GitHub API, CloudQuery/Steampipe/AWS Config, Jenkins API). The defensible layer is not "we inventory AWS" (commoditized, MCP-enabled already) — it is the **cross-layer drift stitch**: binding code + DB schema + cloud + CI into *one* drift-checked, agent-executable graph. Firefly is infra-only; Port/Cortex are service-catalog-only; Multiplayer is architecture/APIs-only; Sourcegraph is code-graph-only. The Connector interface is the mechanism that lets PlanMap consume all of their territory as *input* while owning the stitch on top.

**Extensibility without core changes.** New layer, new Connector — core is unchanged because it only knows the interface and the normalized event shape. This is the same registration pattern that lets Solo ship with exactly one Connector and Org register the full suite from the same binary.

---

## 6. The extension-host ↔ webview ↔ core boundary

The VS Code extension (later milestone, `apps/vscode`) is the sharpest test of core-first, because VS Code enforces a hard process split. It maps cleanly onto the packages:

```
┌─────────────────────────── VS Code ───────────────────────────┐
│                                                                │
│   EXTENSION HOST (Node)                 WEBVIEW (browser ctx)  │
│   ─ trusted, has fs/git/net ─           ─ sandboxed, renders ─ │
│                                                                │
│   @planmap/core        ◀── postMessage(events) ──   @planmap/ui│
│   @planmap/db (Local)                               (React     │
│   @planmap/connectors  ── postMessage(state) ──▶     Flow)     │
│   LLM provider calls                                           │
│                                                                │
│        "HOST THINKS"                      "WEBVIEW DRAWS"       │
└────────────────────────────────────────────────────────────────┘
```

- **Extension host = the brain's home on the desktop.** It runs `@planmap/core`, `@planmap/db` (LocalStore), and `@planmap/connectors` (git). It owns the filesystem, git, ts-morph parsing, hashing, LLM calls, and secret storage. All *thinking* happens here.
- **Webview = a pure renderer.** It runs `@planmap/ui` (React Flow / `@xyflow/react`) inside VS Code's sandboxed browser context. It cannot touch the filesystem or make privileged calls. It receives serialized graph state via `postMessage`, paints Constellation/Feature Space and the active lens, and emits user events (node edited, node approved, lens switched) back to the host.
- **The wire is `postMessage` with serializable payloads.** Because `@planmap/ui` speaks a plain data contract (the same one the web app uses over HTTP), the *identical* UI package renders in three places: inside the VS Code webview, in the standalone Solo local web view, and in the hosted Team/Org web app. The transport differs (`postMessage` vs. `fetch`); the renderer does not.

**How it maps to the edition story.** The extension host is just another surface hosting core + LocalStore, exactly like the CLI. Swap `postMessage` for HTTP and LocalStore for CloudStore and you have the hosted web app talking to `apps/api`. The boundary — *privileged core on one side, dumb renderer on the other* — is the same seam in every surface; VS Code just makes it a literal process boundary.

---

## 7. LLM provider interface — Anthropic default, Bedrock for residency, BYO-key always

**Locked constraints:** provider-agnostic interface; default Anthropic Claude; also Amazon Bedrock (Claude-on-Bedrock) for enterprise data residency; **BYO-key**; **NEVER metered on tokens.** PlanMap makes no LLM margin — and turns that into a trust selling point ("we never see your code or your keys").

```
      @planmap/core (Impact "why", Learn/Guide narration, plan drafting)
                                │  LLMProvider interface
                                │  complete(prompt, opts) → text | stream
              ┌─────────────────┼──────────────────┐
      ┌───────▼────────┐  ┌─────▼──────┐   ┌────────▼─────────┐
      │  Anthropic     │  │  Bedrock   │   │  (future/OSS,    │
      │ @anthropic-ai  │  │ Claude-on- │   │   local models)  │
      │  /sdk (default)│  │  Bedrock   │   │                  │
      └────────────────┘  └────────────┘   └──────────────────┘
        Solo: BYO key       Org: in-VPC, data never leaves account
```

- **One interface, `LLMProvider`**, with `complete()` / streaming. Core never imports a vendor SDK directly; it depends on the interface. Providers are registered like Connectors and Storage adapters — same dependency-inversion pattern used everywhere.
- **Anthropic Claude is the default provider** via `@anthropic-ai/sdk`, keyed by the user (Solo: local secret storage; Team/Org: org secret store). Model routing is not a PlanMap product — a custom router is commodity (LiteLLM ships one free), explicitly rejected.
- **Amazon Bedrock (Claude-on-Bedrock)** is the enterprise-residency provider: for Org/VPC deployments, LLM calls run against Bedrock *inside the customer's AWS account*, so code context never leaves their boundary. This is what makes the "runs in your VPC" Org promise real end-to-end (store, engine, *and* model all in-tenant).
- **Never metered.** Billing is per-seat/edition, never per-token. The provider is the customer's; PlanMap is the layer above it. This is both a trust position and a structural difference from agent vendors who want to own (and meter) the session.

**Critical scope limit on the LLM.** In the two places the LLM touches core reasoning — Impact Analysis and Drift — it is *only ever* the narrator, never the decider (see §8, §9). This is a hard architectural rule, not a prompt preference.

---

## 8. Impact-analysis architecture — the parser decides WHAT, the LLM explains WHY

**This is the hero, and the single most important architectural rule in the product:**

> **A static code parser (ts-morph) decides WHAT is affected. The LLM ONLY explains WHY, in plain language. The LLM never decides what is affected.**

The reason is existential: confidently-wrong impact analysis is *worse than no tool*, because the developer acts on it. LLMs hallucinate dependencies; parsers don't. Accuracy beats coverage. Where the parser is unsure, the answer is "unsure" — never a guess.

**Pipeline (all in `@planmap/core`):**

```
 Node edited in Plan Graph
        │
        ▼
 (1) Resolve linked_code ranges      Node → { path, range } from the .planmap
        │
        ▼
 (2) ts-morph static analysis        Parse imports, call sites, symbol refs.
     builds the dependency map       Build: which symbols call which, which
        │                            files import which. FACTUAL, deterministic.
        ▼
 (3) Graph walk (deterministic)      From the changed ranges, walk dependents
     "WHAT is affected"              outward → affected nodes / files / funcs /
        │                            endpoints / tables. + confidence per edge.
        ▼
 (4) LLM narration (per finding)     For each already-decided affected item,
     "WHY, in plain language"        LLM writes the causal sentence:
        │                            "login.ts calls verifyToken(), whose
        │                             signature changes." NARRATION ONLY.
        ▼
 (5) Impact result                   What / Why / Dependencies / Risk flags
     (uncertainty always visible)    (auth, payments, user data, migrations) /
                                     Confidence (certain vs. inferred).
```

- **Steps 1–3 are pure static analysis and graph theory — no LLM in the causal path.** The set of affected things is computed from the parsed dependency graph, and it is reproducible: same code + same edit ⇒ same affected set, every run. This is the property that is unit-tested against `examples/sample-org`.
- **Step 4 is strictly downstream and read-only over the decision.** The LLM is handed the *already-final* affected set and asked to explain each item in prose. It cannot add, remove, or re-rank what is affected. If the LLM is unavailable, impact analysis still returns the correct WHAT — it simply lacks the narrated WHY.
- **Uncertainty is a first-class output, not a footnote.** Every affected item carries a confidence (certain from a direct reference vs. inferred from a weaker signal). The UI surfaces it. "Say unsure rather than guess" is enforced by the parser emitting confidence, not by asking the model to self-assess.

**Why ts-morph, why TypeScript first.** ts-morph wraps the TypeScript compiler API — the same symbol/reference resolution VS Code uses — giving real, compiler-grade dependency facts rather than regex heuristics. TypeScript/JS is the beachhead language (Solo's connector); accuracy is the moat, so the engine is earned language-by-language rather than faked cross-language on day one.

---

## 9. Drift architecture — hash the linked ranges, verify on save and in CI

**Drift = an APPROVED Plan-Graph node's intent no longer matches the reality of its linked code.** It is measured *against an explicitly approved plan node*, and the stored annotation preserves the WHY. This is the differentiator: generic "architectural erosion" detectors (e.g. the OSS tool literally named *Drift*) flag deviation from generic rules; PlanMap flags deviation from *a specific human-approved intent, with the recorded rationale*. That semantic link — code ↔ approved intent ↔ why — is the defensible version.

**Mechanism (in `@planmap/core`, storage via `@planmap/db`):**

```
 Every implemented node stores, per linked range:
   { path, range:[start,end], hash }         hash = fingerprint of the code range at approval

 VERIFY (on save / on CI run):
   for each linked_code range:
       current_hash = fingerprint(read(path, range))     ← via the Connector's fingerprint()
       if current_hash != stored hash:
           node.status = DRIFTED
           node.drift  = { detected_at, file, issue, likely_cause }   ← LLM explains, doesn't decide
       if range missing / file gone / parse error:
           node.status = ERROR
```

- **The detector is a hash comparison — deterministic, cheap, no LLM.** Re-hash the linked range; mismatch ⇒ `drifted`; missing/broken ⇒ `error`. The *decision* that something drifted is a byte comparison, exactly as the impact decision is a graph walk. The LLM's only role is, again, narration: writing the human-readable `issue` and `likely_cause` on an already-detected drift.
- **Two trigger surfaces, same core function.** Solo verifies on save (the VS Code `onDidSaveTextDocument`-style hook and the CLI). Team/Org verify **drift-in-CI** — the same core `verify()` invoked by the `planmap` CLI as a CI gate, so a PR that silently diverges from approved intent is caught before merge. One function, two entry points; the answer is identical because the logic lives in core.
- **The annotation is the payoff and the moat.** When the "remember me" session window is quietly changed from 30 days to 24 hours outside PlanMap, tests still pass and nothing "breaks" — but the node flags `drifted` and the stored annotation ("30-day window chosen deliberately — repeat-order behaviour is weekly") still holds the *why* that chat history would have lost. Drift is what makes the map incapable of rotting into a stale catalog: reality is re-checked against approved intent continuously, by construction.
- **Fingerprint is per-layer.** For code it's a hash of the parsed range; for schema/cloud/CI the relevant Connector supplies `fingerprint()`. This is how the same drift engine extends from code-only (Solo) to the **cross-layer drift stitch** (Org) without new core logic — each layer just teaches core how to fingerprint it.

---

## 10. Tech stack — with one-line rationales

| Choice | Where | One-line rationale |
|---|---|---|
| **TypeScript** | Everywhere | One language across core, all surfaces, and the target of ts-morph analysis — no context-switch, and the engine and the code it analyzes speak the same type system. |
| **pnpm + Turborepo** | Monorepo | Workspace linking with a strict inward dependency graph + cached, incremental builds/tests along that graph — core-first is enforced and CI stays fast. |
| **`@xyflow/react` (React Flow) + Vite** | `@planmap/ui`, Solo local web | Mature 2D node/edge canvas gives pan/zoom, hit detection, and custom nodes for free; 2D is a locked decision (3D adds occlusion, not space); Vite for fast dev/build of the standalone web view. |
| **Next.js** | `apps/web` | Hosted Team/Org web app — SSR/routing/auth-friendly React host for the same `@planmap/ui`, so localhost and hosted are one UI. |
| **esbuild** | `apps/cli` (+ bundling) | Bundles the `planmap` CLI to a fast, single distributable Node binary — the CI/agent-scriptable surface that runs `verify()` as a gate. |
| **zod** | `@planmap/core`, API/wire | Runtime-validates the `.planmap` schema, connector artifacts, and every `postMessage`/HTTP payload — the data-as-truth store cannot be silently corrupted. |
| **ts-morph** | `@planmap/core` | Compiler-grade symbol/reference/import resolution over the TypeScript compiler API — the parser that *decides WHAT is affected*; accuracy is the moat, so heuristics won't do. |
| **`@anthropic-ai/sdk` + Amazon Bedrock** | LLM provider | Default Claude via the Anthropic SDK; Bedrock (Claude-on-Bedrock) for in-VPC data residency; both behind one `LLMProvider` interface, BYO-key, never metered. |
| **Postgres** | `@planmap/db` CloudStore | Concurrent, org-scoped, auditable central store for Team/Org (hosted or VPC) — the multi-writer half of the Storage adapter. |
| **SQLite (+ JSON)** | `@planmap/db` LocalStore | Zero-daemon, single-file local store for Solo — no account, no server, git-committable JSON/markdown projection; the local-first half of the Storage adapter. |

**One-sentence synthesis.** Every stack choice serves one of three properties: *one language, one engine, one UI across surfaces* (TypeScript, pnpm+Turborepo, `@xyflow/react`, Next.js, esbuild); *the engine cannot lie* (ts-morph decides WHAT, zod guards the data, LLM SDKs only narrate WHY); and *the same codebase runs local-first and hosted/VPC* (SQLite↔Postgres behind the Storage adapter, Anthropic↔Bedrock behind the LLM interface). Those three properties are the architecture.
