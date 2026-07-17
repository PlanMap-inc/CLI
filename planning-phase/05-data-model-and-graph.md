# PlanMap — Data Model & Graph

The data is the product. PlanMap is not a renderer that happens to persist state; it is a **graph store whose contents are the single source of truth**, and everything a user sees is a *projection* of that store. This document specifies that store: the entity hierarchy it spans, the node and edge schema, the `.planmap` on-disk format, how the same rows are projected into a 2D graph and into markdown, and how drift is detected against it.

One dataset feeds everything:

- **Two graphs** over the same nodes — the **Plan Graph** (intended architecture, human-owned) and the **Evolution Graph** (what actually exists, derived from code).
- **Two views** of that data — an interactive **2D graph** (React Flow / `@xyflow/react`) and **auto-generated markdown** (for git diffs, PR review, and Spec Kit / OpenSpec interop).
- **Two storage adapters** with an identical schema — **LocalStore** (SQLite/JSON) and **CloudStore** (Postgres).
- **Three editions** — Solo, Team, Org — differ only in which slice of the hierarchy their **Connectors** populate and which **Entitlements** unlock, never in the schema itself.

The defensible whitespace is the **cross-layer drift stitch**: binding code + DB schema + cloud + CI into one drift-checked, agent-executable graph. That stitch is a *data-model* claim before it is a feature claim — it only works if a single schema can hold a TypeScript function, a Postgres table, and an AWS resource as peers and draw typed edges between them. This document is where that promise is kept or broken.

---

## 1. The Org-Graph Entity Hierarchy

The store models a software estate as a **containment spine** running from the whole organization down to a single cloud resource. Each level is a `Node` (§2); containment is expressed by the `parent` pointer, so the spine is just a tree of parent links. Nothing here is a hardcoded category list — the tree is whatever has actually been built (Evolution) or approved (Plan).

| Depth | Entity | What it is | Node `type` | `level` when rendered | First populated in |
|---|---|---|---|---|---|
| 0 | **Product** | A shippable product spanning several repos | `product` | Constellation (outer) | Team / Org |
| 1 | **Service** | A deployable unit within a product | `service` | Constellation (outer) | Team / Org |
| 2 | **Repo** | A git repository | `repo` | Constellation (outer) | Solo (single), Team (org) |
| 3 | **Module** | A package/directory boundary inside a repo | `module` | Constellation | Solo |
| 4 | **Feature** | A user-visible capability (Login, Cart) | `feature` | **Constellation** (node = feature) | Solo |
| 5 | **Step / Element** | A workflow-significant step inside a feature | `step`, `element` | **Feature Space** (node = step) | Solo |
| 6 | **Endpoint** | An HTTP route / RPC surface | `endpoint` | Feature Space | Team |
| 7 | **Table** | A DB table / schema object | `table` | Feature Space (Backend lens) | Team |
| 8 | **Cloud resource** | An S3 bucket, queue, Lambda, IAM role | `cloud_resource` | Feature Space (Backend/Security) | Org |

**Zoom vs. the spine.** The two Plan-Graph altitudes are locked to two `level` values — **Constellation** (node = feature) and **Feature Space** (node = step/element). The deeper containment above a feature (product → service → repo → module) is *not* a third rendered altitude in v1; it is navigated by re-rooting the Constellation on a different parent. At Solo the Constellation is rooted on one repo and shows its features; at Team/Org the Constellation can be re-rooted on the product to show repos/services as feature-scale regions. This keeps the `level` enum at two values (per the locked rendering decision) while the `parent` spine still records the full estate. The forward path — an explicit `estate` altitude — is a v2 concern, not a v1 field.

**Why the hierarchy is the moat, not a nicety.** Incumbents each own one horizontal slice: Firefly stops at infra, Port/Cortex at the service catalog, Multiplayer at architecture/APIs, Sourcegraph at the code graph. PlanMap's claim is *vertical* — a `feature` node can have `depends_on` edges to a `table` node and a `cloud_resource` node in the same query. That is only possible because all nine entity types are the **same `Node` shape** in the **same store**, differentiated by `type`, not by living in separate databases.

---

## 2. The Node Schema

Every entity at every depth is one `Node`. The schema below extends the original `.planmap` node (spec §8) with the fields needed for the hierarchy, dual-graph, and cross-layer stitch. A single shape serves both graphs; a handful of fields are graph-specific and noted as such.

```json
{
  "id": "node_0087",
  "graph": "evolution",            // plan | evolution
  "level": "feature_space",        // constellation | feature_space
  "type": "element",               // product|service|repo|module|feature|step|element|endpoint|table|cloud_resource
  "title": "Added refresh tokens",

  "intent": null,                  // PLAN graph: the intended behaviour (human-owned)
  "summary": "Issues a long-lived refresh token alongside the JWT; /auth/refresh exchanges it for a new access token.",
  "prompt": "Add refresh token support so users stay logged in",  // EVOLUTION: originating instruction, if any

  "status": "implemented",         // intended | approved | implemented | drifted | error
  "origin": "ai_generated",        // ai_generated | manually_added | ai_edited_by_human
  "parent": "node_0084",           // containment spine (§1)
  "edges_out": ["node_0091"],      // ordered flow to next step(s) at this altitude
  "lens_tags": ["security", "backend"],

  "linked_code": [
    { "path": "src/auth/jwt.ts",     "range": [88, 141], "hash": "c4e2a1", "current_hash": "c4e2a1" },
    { "path": "src/auth/refresh.ts", "range": [1, 62],   "hash": "7b90fd", "current_hash": "7b90fd" }
  ],

  "depends_on": ["node_0084"],       // cached rollup of depends_on-typed edges (derived, §3)
  "depended_on_by": ["node_0091"],   // cached inverse (derived) — node_0091 depends_on this node
  "approved_against": null,          // PLAN node id this Evolution node is drift-checked against (§7)

  "annotation": "7-day refresh window — matches the food-delivery session pattern where users order weekly, not daily.",
  "drift": null,                     // populated only when status = drifted (§7)

  "created_at": "2026-07-06T17:48:00Z",
  "last_verified": "2026-07-16T09:00:00Z"
}
```

| Field | Meaning | Notes |
|---|---|---|
| `id` | Stable node identifier | Never reused; survives renames. |
| `graph` | `plan` or `evolution` | Same node *shape*, different truth source: Plan = intent, Evolution = reality. |
| `level` | Zoom altitude | `constellation` (node = feature) or `feature_space` (node = step/element). A **view selector**, not structure. |
| `type` | Entity kind | Spans the full hierarchy (§1). Drives icon/shape and which Connector owns it. |
| `title` | Human label | — |
| `intent` | **Plan only** — what it *should* do | Human-owned. AI drafts, human edits, human wins. `null` on Evolution nodes. |
| `summary` | **Evolution only** — what the code *does* | Derived by reading code, not chat history. `null` on pure Plan nodes. |
| `prompt` | Originating instruction (Evolution) | Optional provenance; never the source of *placement* (§7). |
| `status` | Lifecycle state | `intended → approved → implemented → drifted/error`. See table in §7. |
| `origin` | Who authored it | Human-authored nodes are **never silently overwritten** by AI. |
| `parent` | Containment | The spine (§1). Single parent. |
| `edges_out` | Flow at this altitude | Ordered next-step(s) — the business/backend/security arrows, lens-filtered. |
| `lens_tags` | Business / Backend / Security | Metadata only. A tag never moves a node (§5, §7). |
| `linked_code[]` | `{path, range, hash, current_hash}` | The location of the real code. Basis of drift (§7). |
| `depends_on` / `depended_on_by` | Cached dependency rollups | Derived from typed `depends_on` edges (§3); present for fast rendering, not authored. |
| `approved_against` | Plan-node baseline | The **explicitly approved** Plan node this Evolution node is measured against. Drift is meaningless without it. |
| `annotation` | The **why** | The behavioral moat. The thing chat loses. |
| `drift` | Drift record | `null` unless `status = drifted` (§7). |
| `created_at` / `last_verified` | Timestamps | `last_verified` = last time hashes were re-checked. |

**Reconciling `intent` vs. `summary`.** These are deliberately separate fields, not one polymorphic field, because **drift is exactly the delta between them**: `intent` is the approved Plan node's promise; `summary` is what the Evolution node found in code. Collapsing them would erase the comparison that is the entire product.

---

## 3. Edge Types

Containment (`parent`) and flow (`edges_out`) are stored on the node. **Semantic relationships are first-class `Edge` records** so that Impact Analysis can walk them without re-parsing, and so cross-layer relations (a feature that `writes` a table, a service that `deploys` a cloud resource) are queryable joins rather than prose.

```json
{
  "id": "edge_0311",
  "type": "writes",                // imports | calls | depends_on | deploys | reads | writes
  "from": "node_0087",             // src/auth/refresh.ts element
  "to":   "node_0250",             // table: refresh_tokens
  "graph": "evolution",
  "provenance": "static_analysis", // static_analysis | connector:postgres | connector:aws | connector:jenkins | manual
  "confidence": "certain"          // certain | inferred  — uncertainty is always visible
}
```

| Edge `type` | Meaning | Source of truth | Layer(s) | Populated in |
|---|---|---|---|---|
| `imports` | Module/file imports another | Static analysis (ts-morph) | code | Solo |
| `calls` | Symbol invokes another symbol | Static analysis (symbol + reference providers) | code | Solo |
| `depends_on` | Logical dependency (rolled onto nodes) | Static analysis + connectors | any | Solo |
| `deploys` | CI/infra deploys a service/resource | Connector: Jenkins / AWS Config | CI → cloud | Org |
| `reads` | Code reads a table/endpoint/resource | Static analysis + DB/AWS connectors | code → data/cloud | Team |
| `writes` | Code writes a table/endpoint/resource | Static analysis + DB/AWS connectors | code → data/cloud | Team |

**Hard rule, inherited from Impact Analysis:** edges are decided by a **static parser or a Connector, never by the LLM**. LLMs hallucinate dependencies; parsers don't. The LLM's only job anywhere in this system is explaining *why* an edge matters in plain language — it never invents an edge. Every edge carries `provenance` and a `confidence` of `certain` vs. `inferred`, and inferred edges render visibly distinct. This is what keeps the cross-layer stitch honest: a `reads`/`writes` edge from code to a Postgres table is a parsed query + a connector-supplied schema, not a guess.

---

## 4. The `.planmap` Format & Storage-Adapter Parity

### 4.1 On-disk layout (git-committed)

The canonical store serializes to a `.planmap/` directory committed to the repo. One file per node/edge keeps git diffs small and reviewable; the generated markdown (§6) is what humans read in PRs.

```
.planmap/
  config.json            # store version, edition, registered connectors, LLM provider
  nodes/
    node_0084.json       # one node per file → clean, line-scoped diffs
    node_0087.json
  edges/
    edge_0311.json       # one edge per file
  drift/
    node_0102.json       # drift events, appended
  projections/
    plan/*.md            # GENERATED markdown (derived, §6)
    evolution/*.md       # GENERATED markdown (derived, §6)
```

`config.json` records the schema `version` so a store written by Solo opens unchanged in Team/Org. The canonical truth is the JSON under `nodes/`, `edges/`, `drift/`; `projections/` is regenerated and **JSON always wins** on conflict.

### 4.2 Logical schema (adapter-independent)

The same logical tables back both adapters. LocalStore may materialize them as SQLite tables or as the JSON files above; CloudStore materializes them as Postgres tables. The column set is identical.

| Logical table | Key columns | Notes |
|---|---|---|
| `nodes` | `id, graph, level, type, status, origin, parent, …` | §2 |
| `edges` | `id, type, from, to, graph, provenance, confidence` | §3 |
| `code_links` | `node_id, path, range, hash, current_hash` | Normalized from `linked_code[]` |
| `annotations` | `node_id, body, author, ts` | The reused *why*; append-only history |
| `approvals` | `plan_node_id, approver, ts` | What makes a node the drift baseline (`approved_against`) |
| `drift_events` | `node_id, detected_at, file, issue, likely_cause` | §7 |

### 4.3 Parity is a contract, not a coincidence

```
                 StorageAdapter (interface)
                /                          \
         LocalStore                     CloudStore
      SQLite / JSON files                Postgres
      Solo: local-first, no account      Team/Org: hosted or self-host/VPC
                \                          /
                 identical logical schema
```

- **Same schema, byte-for-byte semantics.** A Solo `.planmap` store pushes to a Team CloudStore losslessly, and a CloudStore exports back to `.planmap` losslessly. The migration is a copy, not a transform. This is what makes the **land-Solo → expand-Team** GTM mechanically real: there is no data lock-in step and no re-modeling.
- **Neutrality by construction.** Solo runs entirely on LocalStore with a BYO LLM key and no account. Tokens are **never metered**. The store never leaves the machine unless the user opts into CloudStore. Org can run CloudStore in the customer's own VPC (with Claude-on-Bedrock) for data residency — same schema, different network boundary.
- **One engine, three editions.** Editions gate *which Connectors write to the store* and *which Entitlements read from it* — they do **not** fork the schema. That is the only way the cross-layer stitch can be the same object at every tier.

---

## 5. Zoom & Lenses as Views Over One Dataset

Zoom and lenses are **query parameters over the store**, not stored variants of the graph. A node's meaning is `zoom level × active lens`; the underlying row never changes.

| | **Business lens** | **Backend lens** | **Security lens** |
|---|---|---|---|
| **Constellation** (node = feature) | features linked by user journey | same features linked by data/request flow | features as trust boundaries |
| **Feature Space** (node = step) | `land → home → Register → email → password → submit → dashboard` | `API → route → middleware → controller → service → DB → response` | `credentials → validate → hash check → JWT → authorize → granted` |

How each axis maps to fields:

- **Zoom** filters by `level` and re-roots on `parent`. Constellation renders `level = constellation` nodes under the current root; clicking one re-roots to its children at `level = feature_space`. Zoom is spatial (fly down / fly out); it changes *which* nodes render.
- **Lens** filters by `lens_tags` and reinterprets which `edges_out` / typed edges to draw. Business follows user-journey flow; Backend follows `calls`/`reads`/`writes`; Security highlights nodes tagged `security` and the trust-boundary edges among them. **A lens never moves a node and never changes altitude** — it only hides tags and re-picks edges. Same tree, same positions, fewer nodes.

Because both are pure functions of the stored fields, switching lens or zoom is instant and reversible, and two users at different altitudes/lenses are looking at *the same committed data*.

---

## 6. Dual-View Projection: Graph + Markdown

The store is projected two ways from the identical rows:

1. **2D graph** — ephemeral, interactive, React Flow. Nodes and edges are laid out live; nothing here is committed to git. This is the "controls" surface — click a node, edit it, trigger Impact Analysis.
2. **Generated markdown** — committed under `.planmap/projections/`. This is the diffable, reviewable, tool-interoperable face of the same data.

Markdown exists for three concrete reasons: **clean git diffs** (a reviewer sees "intent changed from 7-day to 30-day" as a one-line diff), **PR review** (architecture changes are reviewed in the PR, not a separate tool), and **interop** with spec-driven-development formats like Spec Kit / OpenSpec. The graph is the thinking surface; the markdown is the paper trail.

A single node projects deterministically. The Evolution node `node_0087` from §2 becomes:

```markdown
### Added refresh tokens  ·  `implemented`  ·  security, backend

Issues a long-lived refresh token alongside the JWT; `/auth/refresh` exchanges
it for a new access token without re-authentication.

- **Parent:** Added JWT auth
- **Depends on:** Added JWT auth
- **Code:** `src/auth/jwt.ts:88–141`, `src/auth/refresh.ts:1–62`
- **Why:** 7-day refresh window — matches the food-delivery session pattern
  where users order weekly, not daily.
```

**JSON is truth; markdown is derived.** The projector runs on save and in CI; if a human hand-edits the markdown, it is re-projected from JSON on the next run and the edit is discarded — the graph store wins, always. This one-way rule is what prevents the two representations from drifting apart into a second consistency problem.

---

## 7. Drift Detection & the Evolution Placement Rule

Drift is the payoff and the central engineering problem: **Plan says X, Evolution says Y, and both change independently.** The data model handles it with two mechanisms — a mechanical hash check that decides *what* changed, and a semantic step that decides *whether it is really drift and why*. This mirrors the Impact Analysis rule exactly: a mechanical process decides *what*, the LLM only explains *why*.

### 7.1 The hash mechanism

Each `linked_code[]` entry stores `hash` (content hash of the range at approval/verification time) and `current_hash` (recomputed on re-read). Hashes are over the **whitespace-normalized** range to avoid trivially flagging a reformat as drift.

```
on save / CI run:
  for each linked_code entry:
    current_hash = hash(normalize(code at path:range))
  if any current_hash != hash:
      → candidate drift  (mechanical: something in the linked code changed)
      → run semantic check against `approved_against` Plan node's intent
          matches intent still?  → re-verify, update hash, keep `implemented`
          diverges from intent?   → status = drifted, populate `drift{}`
      if linked code missing / won't parse → status = error
```

Two rules make this trustworthy:

- **Drift is measured against an explicitly APPROVED Plan node** (`approved_against`). A change with no approved baseline can't "drift" — it's just unmapped reality. This is why `approvals` is a first-class table (§4.2).
- **The `annotation` survives the drift.** When code diverges, the *why* is still on the node. That is the whole thesis: the 30-day decision and its reason don't vanish silently.

### 7.2 The Evolution placement rule (semantic, not keyword)

When a new Evolution node is derived from written code, its **position is decided by what it is *about*** — never by keyword. Every candidate runs the same 3-step test:

| Step | Question | Placement |
|---|---|---|
| 1 | Does it **extend or fix** an existing node? | child of that node |
| 2 | Does it belong to an existing **feature**? | new child under that feature |
| 3 | Has nobody touched this capability before? | new top-level node |

Consequences: "improve login speed" nests under **Login**, not a "Performance" node; a taller header nests under **Login**, not a top-level "Frontend" node. `lens_tags` record that these are `backend`/`frontend` — but tags are metadata and **never** determine position. The top level is not a preset category list; it is whatever independent capabilities were actually built, in first-appearance order.

### 7.3 Node states

| State | Meaning |
|---|---|
| `intended` | Human-authored in the Plan Graph; no code yet |
| `approved` | Reviewed/approved; not yet implemented — becomes a drift baseline |
| `implemented` | Built; linked to real code; `hash == current_hash`; matches intent |
| `drifted` | Linked code changed and no longer matches the approved intent |
| `error` | Linked code is broken, missing, or won't parse |

### 7.4 Worked JSON — a healthy node

```json
{
  "id": "node_0087",
  "graph": "evolution",
  "level": "feature_space",
  "type": "element",
  "title": "Added refresh tokens",
  "intent": null,
  "summary": "Issues a long-lived refresh token alongside the JWT; /auth/refresh exchanges it for a new access token without re-authentication.",
  "prompt": "Add refresh token support so users stay logged in",
  "status": "implemented",
  "origin": "ai_generated",
  "parent": "node_0084",
  "edges_out": ["node_0091"],
  "lens_tags": ["security", "backend"],
  "linked_code": [
    { "path": "src/auth/jwt.ts",     "range": [88, 141], "hash": "c4e2a1", "current_hash": "c4e2a1" },
    { "path": "src/auth/refresh.ts", "range": [1, 62],   "hash": "7b90fd", "current_hash": "7b90fd" }
  ],
  "depends_on": ["node_0084"],
  "depended_on_by": ["node_0091"],
  "approved_against": "node_p084",
  "annotation": "7-day refresh window — matches the food-delivery session pattern where users order weekly, not daily.",
  "drift": null,
  "created_at": "2026-07-06T17:48:00Z",
  "last_verified": "2026-07-16T09:00:00Z"
}
```

Both hashes match, `status = implemented`, `drift = null`. Nothing to flag.

### 7.5 Worked JSON — a drifted node

```json
{
  "id": "node_0102",
  "graph": "evolution",
  "level": "feature_space",
  "type": "element",
  "title": "Added remember me",
  "intent": null,
  "summary": "Checkbox on the login form; when checked, extends session lifetime to 30 days.",
  "prompt": "Add a remember me checkbox to login",
  "status": "drifted",
  "origin": "ai_generated",
  "parent": "node_0080",
  "edges_out": [],
  "lens_tags": ["frontend"],
  "linked_code": [
    { "path": "src/auth/login.ts",    "range": [42, 78], "hash": "a91f33", "current_hash": "e17c08" },
    { "path": "src/ui/LoginForm.tsx", "range": [15, 34], "hash": "5d2b41", "current_hash": "5d2b41" }
  ],
  "depends_on": ["node_0080"],
  "depended_on_by": [],
  "approved_against": "node_p080",
  "annotation": "30-day window chosen deliberately — repeat-order behaviour is weekly.",
  "drift": {
    "detected_at": "2026-07-15T14:22:00Z",
    "file": "src/auth/login.ts",
    "issue": "Session lifetime is now hardcoded to 24h. The 30-day extension this node describes no longer exists in the code.",
    "likely_cause": "Modified outside PlanMap — no approved plan node corresponds to this change."
  },
  "created_at": "2026-07-05T16:22:00Z",
  "last_verified": "2026-07-15T14:22:00Z"
}
```

`src/auth/login.ts` changed (`a91f33 → e17c08`) while `LoginForm.tsx` did not. The hash check flags the candidate; the semantic check against the `node_p080` baseline confirms real divergence and writes `drift{}`; the `annotation` still holds the reason the 30-day window existed. This single object is the thesis: a change no test caught, that chat would have lost, surfaced with its *why* intact.

---

## 8. Honest Risks in the Data Model

Being adversarial about where this schema can fail:

- **Hash-based drift is noisy at the edges.** Whitespace normalization kills the cheapest false positives, but a behavior-preserving refactor (rename, extract-function, moved range) still changes `current_hash` and triggers a semantic re-check on every save. If the semantic check is wrong, we get exactly the failure mode the product exists to prevent — a **confidently-wrong flag**. Mitigation: the mechanical check only ever *proposes*; `drifted` is only written after the semantic step confirms against `approved_against`, and confidence is always visible. Line-range tracking under refactors is a known hard problem, not solved by hashing alone.
- **Cross-layer join keys are fragile.** A `writes` edge from code to a Postgres `table`, or a `deploys` edge from Jenkins to a `cloud_resource`, depends on resolving names across systems (ORM model → table name, Terraform logical id → live ARN). When the join key is ambiguous the edge must be marked `inferred`, never `certain`. Over-claiming certainty here quietly poisons the stitch that is the whole moat.
- **The two-value `level` enum understates the hierarchy.** Nine entity depths (§1) are navigated through only two rendered altitudes plus re-rooting. At large estates this may feel cramped; an `estate` altitude is the planned v2 answer, deferred deliberately to protect the locked 2D/two-altitude rendering decision rather than shipped half-built.
- **JSON ↔ markdown is one-way by fiat.** Making JSON authoritative avoids a second consistency problem, but it means the markdown is *not* an editing surface — a contributor who edits `.planmap/projections/*.md` in a PR will have their change silently overwritten. This must be documented loudly or it becomes a trust bug.
- **Placement is semantic, so it can be wrong.** The 3-step rule depends on judging what a change is *about*. Ambiguous changes ("send confirmation email" belongs to Checkout *and* Order Tracking) have no clean home; cross-feature nodes are an open modeling question, not a settled one.
- **Schema parity is a promise that must be tested, not assumed.** "LocalStore and CloudStore are identical" holds only as long as every migration is applied to both and a round-trip (`.planmap` → Postgres → `.planmap`) is verified in CI. The moment they diverge, the Solo→Team upgrade stops being lossless and the GTM wedge cracks.
