# PlanMap — Risks & Open Questions

> **Purpose.** This is the adversarial document. Every other doc in the planning set argues why PlanMap should exist; this one argues, as honestly as possible, how it dies. It consolidates the risks flagged across the two market-research reports and the design specs, ranks them, and attaches a one-line mitigation to each. A risk without a mitigation you can actually execute is not a risk register — it is a suicide note. A mitigation without a named risk is marketing.
>
> **Citation key.** `[R1:n]` = Market Research Report #1 (SDD / AI plan-mode landscape). `[R2:n]` = Market Research Report #2 (IDP / org-map / config-graph / agent-platform landscape). Numbers map to those reports' Sources lists. A section reference like `[R1:§5]` (using the section-sign) points to a whole section of a report rather than a numbered source, used where a claim is supported by a section's discussion rather than a single entry. Figures preserve the reports' own uncertainty flags: **[unverified]** = corroborated by ≤1 source or vendor-compiled; **[directional]** = market-firm estimate, methodology-dependent. No figure here is invented.

---

## 0. How to read this document

Risks are triaged into four tiers by a single question: **does this kill the company, or just cost us a quarter?**

| Tier | Meaning | Examples |
|---|---|---|
| **P0 — existential** | If we are wrong here, there is no product. | The untested graph-vs-markdown bet; false-positive trust collapse; the catalog-graveyard failure mode. |
| **P1 — severe** | Survivable, but defines whether we win or merely exist. | Cross-language static-analysis accuracy; fast-follow by a giant; freemium non-conversion. |
| **P2 — chronic** | Never "solved," managed forever. | Ingestion maintenance treadmill; keeping the map fresh; consolidation whiplash. |
| **P3 — open questions** | Not yet risks — decisions we have deliberately deferred and must resolve before the milestone that depends on them. | Postgres+CTE vs graph DB; buy/borrow ingestion order; agent-execution sandboxing; Learn/Guide depth; Solo↔hosted format parity. |

The uncomfortable truth up front: **PlanMap is entering a category that is simultaneously real, hot, funded — and a documented graveyard** [R2:9]. The best-capitalized players (Port's $100M/$800M raise, Atlassian's 150B-edge Teamwork Graph, GitHub Agent HQ) are converging on the exact "agents act on an org-wide map" concept [R2:3][R2:18][R2:21], while the predecessors that tried the naive version of it (ServiceNow CMDB, Backstage catalogs, CodeSee) died of staleness and non-conversion [R2:10][R2:8][R1:44]. We are not early. We are betting on a *specific stitch* nobody else fully owns and on *freshness-by-construction* as the thing that keeps us out of the graveyard.

---

## 1. The #1 untested assumption (P0)

**Assumption: an editable, zoomable Plan Graph actually beats chat + markdown specs for real developers.**

This is the single highest risk in the entire venture, and both the market report and our own v1 spec name it as such [R1:13][R1:24]. Everything downstream — Constellation/Feature Space Zoom, the three Lenses, the dual-view projection — is scaffolding on top of a UX hypothesis that has *never been tested with one real user*.

**Why it might be wrong (steelman the null hypothesis):**
- Every shipping spec-driven-development tool today is **markdown-file-based** — GitHub Spec Kit, OpenSpec, and AWS Kiro all emit `.md` and nothing else [R1:13][R1:22]. Spec Kit reached ~90k–111k GitHub stars in ~9 months on pure markdown + slash commands [R1:12][R1:14]. The market has voted, so far, for text.
- Native "plan modes" in Cursor and Claude Code are chat/text, ephemeral, and *inside the tool the developer already lives in* — zero context-switch, zero new surface [R1:29][R1:33]. For most users this may be "good enough."
- The closest visual-first predecessor, **CodeSee, is dead** — strong free-user growth, inconsistent revenue, "beautiful graph is a nice-to-have that didn't attach to a budget-owning workflow" [R1:44][R2:22]. Developers have repeatedly declined to maintain a heavier visual layer.

**Why it might be right (our actual bet):** the graph is not the value — it is the *on-ramp to the value*. The hero is Impact Analysis and Drift; the graph is how a human reviews and edits intent at a glance and how the cross-layer drift stitch becomes legible. If we are right, the graph earns its surface area because chat cannot show "what breaks and why" as a spatial, zoomable object.

> **Mitigation (one line):** ship the Impact Analysis + Drift value so it is useful *even to a user who barely touches the graph*, project the .planmap data to auto-generated markdown so we never lose to the text crowd on interop, and instrument the one metric that settles the bet — do users return to the graph, unprompted, on their 2nd and 3rd feature.

**The three metrics that resolve this before we over-build:** (1) do users *approve* Plan Graph nodes (engagement with the gate)? (2) do they *keep and reuse* annotations over time (the real moat signal)? (3) does Impact Analysis change behavior — fewer reverts/rework, measurable via git churn using GitClear's own methodology [R1:7]? If the answer to all three is "no," the graph is a museum piece and we pivot to a markdown-first, impact-analysis-only tool.

---

## 2. Technical risks (P0–P2)

### 2.1 Cross-language static-analysis accuracy (P1, rising to P0 as languages expand)

The entire credibility pitch is *"a static code parser decides WHAT is affected; the LLM only explains WHY."* That anti-hallucination split [R1:16][R1:§5] is our sharpest wedge precisely because competitors structurally under-invest in it — they are incentivized to *showcase* LLM magic, not constrain it. But it means **accuracy is the moat, and it is an engineering moat we have to earn, not assert.**

- We start TypeScript/JavaScript-only via `ts-morph` (a LOCKED decision). That is the right narrowing, but the moment Team/Org tiers demand Python, Go, Java, and SQL, accuracy-per-language becomes a combinatorial treadmill.
- Cross-language edges (a TypeScript route that calls a Python service that reads a Postgres table) are exactly where parser-based analysis is weakest and where the "cross-layer drift stitch" lives. The stitch is the moat *and* the hardest thing to get right.

> **Mitigation:** stay single-language (TS/JS) until Impact Analysis accuracy is provably high on it; when a parser is unsure, mark the edge `inferred` and say "unsure" rather than guess — coverage is negotiable, a confident wrong answer is not.

### 2.2 False-positive trust collapse (P0)

This is the technical risk that is actually existential. Trust in an impact/drift tool is **asymmetric**: a handful of confidently-wrong "this will break" calls destroys adoption faster than a hundred missed edges, because the developer *acts on* the false positive [R1:§7]. The same asymmetry killed catalogs — "a stale catalog erodes trust fast, and once developers stop believing the portal, adoption collapses" [R2:8]. Drift detection has the mirror failure: fire too eagerly and it becomes alarm fatigue, the noisy-linter death [R1:§7].

> **Mitigation:** make uncertainty always visible in the UI (certain vs. inferred, with confidence), tune the drift/impact thresholds from real usage not theory, and treat "precision over recall" as a product law — we would rather miss an edge than invent one.

### 2.3 Keeping the map fresh (P0 — this is the whole thesis)

Freshness-by-construction *is* the wedge [R2:§6]. The Evolution Graph must re-derive from real code/infra, and Drift is measured against an explicitly approved Plan node. The failure mode is the "two truths" problem from our own spec: Plan (intent) and code (reality) both change independently, and Evolution-from-code is a *mitigation, not a cure* (see doc 05 §7, Drift Detection). If the map lags reality by even days, it becomes the thing every predecessor became — stale, untrustworthy, abandoned. ServiceNow's CMDB is the 20-year monument to this [R2:10]; Backstage catalogs are "never completed" [R2:8].

> **Mitigation:** re-hash linked code ranges on every save and re-verify drift in CI (Team tier) so the map can never silently rot; never accept a single human-maintained field that isn't derived from ground truth.

### 2.4 The ingestion maintenance treadmill (P2, chronic)

For the Org edition, the cross-layer stitch needs connectors to GitHub org, Postgres/DB schema, AWS, Jenkins, and Bedrock usage. Each connector is a permanent maintenance liability. The sobering evidence: **CloudQuery (~$34.5M raised) and Firefly (~$29.5M) are funded companies whose entire existence is the ingestion layer** [R2:12][R2:9], and Steampipe exists purely to maintain 150+ provider integrations [R2:11]. Backstage adopters name upgrades — often requiring code changes, not a version bump — as their single biggest pain point (56% cite it) [R2:5]. A tiny team cannot out-integrate funded ingestion specialists, and trying is a direct path to death by treadmill.

> **Mitigation:** BUY/BORROW ingestion (GitHub API, CloudQuery/Steampipe, AWS Config, Jenkins API) as inputs and BUILD only the drift-graph + agent-execution brain — never compete on breadth of integrations.

---

## 3. Competitive risks (P1–P2)

### 3.1 Fast-follow by giants and funded specialists (P1)

Features are copyable in a quarter; the whole first report concludes the *combination* is uncontested but each *part* is not [R1:§5]. The concrete threats, ranked by how directly they can eat our lunch:

| Threat | Why it is dangerous | Why we can still win |
|---|---|---|
| **Port** ($100M/$800M, Dec 2025) — "Context Lake" + agent registry, ~$30/seat, agents execute against the catalog [R2:3][R2:26] | Closest competitor to "agents act on the map," now extremely well-capitalized | Service-catalog-only; no code+schema+cloud+CI drift stitch, no static-analysis impact |
| **Atlassian** — Teamwork Graph (150B+ connections) opened to any MCP agent; Rovo used by >90% of enterprise cloud customers [R2:18] | Enormous enterprise distribution; conceptually the closest analog to our north star | Work-graph, not code/infra reality; no intent-vs-reality drift on real code |
| **GitHub** — Agent HQ + `AGENTS.md`; owns the repos that are our substrate [R2:21] | Owns distribution *and* the code substrate our map reads | Structurally non-neutral (wants you in Copilot); Copilot Workspace, its own "plan then build," was already sunset May 2025 [R1:31] |
| **AWS** — Bedrock AgentCore GA Oct 2025; Kiro spec-first IDE [R2:15][R1:18] | Managed substrate to build (or crush) an "agents-on-estate" product | Kiro is an IDE you switch to (lock-in); markdown specs, no drift product; botched Aug 2025 pricing burned trust [R1:21] |
| **Cortex** ($60M, "Magellan" AI catalog import + MCP) [R2:2][R2:25] | Using AI to solve the catalog-population problem — our exact mechanism | Service-catalog scope, not cross-layer code+infra drift |
| **Tessl** ($125M, ~$500–750M, Snyk-caliber founder) [R1:40][R1:41] | Same "intent lives in the spec" narrative, heavyweight capital | Far heavier "rewrite how software is made" bet; if it ships approachable impact/visual tooling it competes for our narrative |

> **Mitigation:** lead with the one thing structurally hard to copy — earned static-analysis accuracy × drift-against-*approved-intent* semantics × the cross-layer stitch — and win on the neutral, agent-agnostic, local-first, BYO-key position that every agent vendor is *disincentivized* to occupy [R1:§5].

### 3.2 Platform-consolidation whiplash (P2, chronic)

The substrate shifts violently. Windsurf was dismembered across Google/Cognition in ~72 hours [R1:34][R1:35][R1:50]; CodeSee was absorbed into GitKraken [R1:44]; Sourcegraph split Cody (enterprise-only, $59) from Amp (spun into a separate company, Dec 2025) [R1:37][R1:39]. Any product built *on top of one agent vendor* is existentially fragile.

> **Mitigation:** neutrality is the hedge — agent/IDE-agnostic with a local-first option means no single vendor's implosion can take us with it; but note neutrality *reduces* whiplash risk, it does not eliminate it (we still consume APIs that can change).

### 3.3 OSS commoditization (P2)

Our primitives are being given away. An OSS tool literally named **"Drift"** already does static-analysis architectural-erosion detection for AI code, with a GitHub Action [R1:46][R1:47]. Spec Kit and OpenSpec give away SDD scaffolding [R1:14][R1:22]. A wave of code-knowledge-graph-for-agents OSS projects (CodeGraph, GitNexus) is exploding in stars, mostly local-first + MCP [R2:17]. Worse for *lock-in*: our own `.planmap` store is plain JSON in git — deliberately anti-lock-in, which is great for adoption and **bad for defensibility** [R1:§5][R1:§5].

> **Mitigation:** the moat is behavioral (accumulated, reused annotations — the WHY that no scan can reconstruct) and technical (earned accuracy), not the format — make annotations sticky through reuse in drift checks, onboarding, and audit so teams feel loss on leaving even though the door is open.

---

## 4. Business / execution risks (P0–P1)

### 4.1 Tiny-team scope (P1)

Building trustworthy cross-language static analysis + a polished multi-surface product (CLI + VS Code + local web, then hosted) + a connector suite is enormous scope for a small team [R1:§7]. The reports are blunt: broad, accurate, always-fresh org-wide ingestion is a "multi-year, multi-team effort" and is why the ingestion specialists are *funded companies doing only that* [R2:§6].

> **Mitigation:** sequence ruthlessly per the LOCKED milestone order — M1 is the auto-map + impact + drift engine + storage adapter + git/TypeScript connector shipped as Solo (local-first); breadth (cross-layer connectors, agent-execution control plane) is deferred to M3.

### 4.2 Freemium conversion (P1)

The bottom-up-land / top-down-expand GTM depends on a free Solo tier converting to paid Team/Org. Two documented hazards bracket this: **CodeSee died because free couldn't convert** (visualization was a nice-to-have with no recurring budget) [R1:44], and there is **no established budget line for an "AI planning/governance layer"** — buyers may not know they should pay for it [R1:§7]. Low ARPU freemium requires either large volume (distribution risk) or fast team-tier conversion (proven-value risk).

> **Mitigation:** make the Solo tier genuinely useful but put the *team* value — shared Plans, approval workflow, drift-in-CI, cross-repo Impact, roles — behind the Team tier, and never meter LLM tokens (BYO-key; turn "no LLM margin" into a trust selling point rather than a paywall).

### 4.3 The catalog-graveyard failure mode (P0)

This is the business risk that is existential, and it deserves its own tier. The org-map category is *both* buyable and a graveyard [R2:§6]: Port raised $100M on the thesis, but ServiceNow CMDB decayed into "stale, untrustworthy data" over 20 years [R2:10], Backstage catalogs are "never completed" [R2:5][R2:8], ~half of platform-engineering teams are disbanded or restructured within ~18 months and ~60–70% of initiatives fail to deliver impact **[directional/unverified]** [R2:20], and CodeSee shut down outright [R2:22]. The naive "boil-the-ocean, human-maintained, sold-top-down" map *is the failure mode itself.*

> **Mitigation:** PlanMap must NEVER be a human-maintained catalog — auto-population and auto-refresh from ground truth is the product, not a feature; land narrow (one repo / one product's prod path, undeniably accurate, agent-executable) and expand org-wide only after trust is earned.

---

## 5. Open questions still to resolve (P3)

These are deliberately deferred decisions, not unmanaged risks. Each must be resolved *before* the milestone that depends on it, not before then.

### 5.1 Postgres-with-recursive-CTEs vs. a dedicated graph DB at scale

The LOCKED storage adapter is LocalStore (SQLite/JSON) and CloudStore (Postgres) with an identical schema. The Plan Graph and Evolution Graph are graphs; graph traversal (impact walks, drift propagation) on Postgres uses recursive CTEs, which are fine at Solo/Team scale but an open question at Org estate scale (thousands of services, hundreds of thousands of cloud resources [R2:8]).

> **Resolve by M3.** Ship Postgres + recursive CTEs now (identical schema, zero added ops), benchmark impact-walk latency on the sample-org fixture, and only introduce a graph DB behind the storage adapter if traversal — not ingestion — becomes the proven bottleneck.

### 5.2 Exactly which ingestion sources to buy/borrow first

The strategy is BUY/BORROW ingestion, but the *order* is unresolved. Steampipe (live SQL query, MCP-enabled [R2:11]) vs. CloudQuery (ELT into your own Postgres [R2:12]) is a genuine architectural fork the reports flag explicitly [R2:§2].

> **Resolve by M3.** Sequence by tier need: GitHub API first (M1, already the git connector), then Postgres schema + AWS Config for the first cross-layer drift demo (M3), borrowing CloudQuery/Steampipe/Jenkins API as inputs — prove the "point at GitHub org + AWS account + Jenkins, see an accurate drift map for one product's prod path within an hour" flow [R2:§6] before adding a fourth source.

### 5.3 Agent-execution safety / sandboxing

Team/Org tiers let PlanMap dispatch an agent to open an impact-gated PR, with drift re-verified afterward. Handing scoped instructions to an autonomous agent that writes code raises unresolved safety questions: blast radius, permission scope, and whether execution is sandboxed. The whole ecosystem is building control planes for exactly this (GitHub Agent HQ's permissions/policy/audit [R2:21], Bedrock AgentCore's Identity/Observability [R2:15]) — we cannot ship agent execution without answering it.

> **Resolve by M3.** Agent execution is impact-gated by construction (a human approves the Plan node and its Impact Analysis before dispatch) and drift-re-verified after; scope, sandboxing model, and the org policy-gate design are M3 deliverables tied to the agent-execution control plane, not M1.

### 5.4 Learn/Guide mode depth

Learn/Guide mode is "same data, new view + entitlement" — a pedagogical projection of the auto-populated map, re-verified by drift so it cannot rot (unlike CodeSee's hand-authored tours [R1:44]). Open question: *how deep* — a light guided-tour overlay, or a full progressive-disclosure curriculum? Depth trades directly against the tiny-team scope risk (§4.1).

> **Resolve after M1 signal.** Start shallow (business-first guided tour of the real prod path, generated from the live map) and let return-usage data decide whether deeper curriculum is worth the surface area — do not build depth on an unvalidated view.

### 5.5 Does Solo local-first share a format with the hosted store?

The LOCKED decision says yes — one engine, identical schema across LocalStore and CloudStore, same web UI on localhost or hosted. The open question is whether format parity survives *contact with reality*: hosted multi-tenant concerns (org-wide edges, RBAC scoping, audit metadata) may pressure the schema to diverge, which would fracture the "solo dev's .planmap upgrades cleanly to team" promise that the whole GTM ladder rests on.

> **Resolve by M2.** Treat the .planmap schema as the contract: hosted-only concerns (RBAC, audit, cross-repo edges) must be *additive* fields the storage adapter layers on, never a divergent schema — validate by round-tripping a Solo store into CloudStore and back before M2 ships.

---

## 6. The risk register, at a glance

| # | Risk | Tier | One-line mitigation |
|---|---|---|---|
| 1 | Editable graph may not beat chat + markdown | **P0** | Deliver impact/drift value even without the graph; instrument return-usage to settle the bet. |
| 2 | False-positive trust collapse | **P0** | Precision over recall; uncertainty always visible; say "unsure," never guess. |
| 3 | Keeping the map fresh (two-truths / staleness) | **P0** | Re-hash on save + drift-in-CI; zero human-maintained fields. |
| 4 | Catalog-graveyard failure mode | **P0** | Never a human-maintained catalog; auto-populate, land narrow, expand on earned trust. |
| 5 | Cross-language static-analysis accuracy | **P1** | Stay TS/JS until accuracy is proven; mark inferred edges; accuracy is the moat. |
| 6 | Fast-follow by giants / funded specialists | **P1** | Win on accuracy × drift-against-intent × neutral, agent-agnostic, local-first position. |
| 7 | Tiny-team scope | **P1** | Sequence ruthlessly on the M1→M2→M3 milestone ladder; defer breadth. |
| 8 | Freemium non-conversion / no budget line | **P1** | Team value behind the Team tier; never meter tokens; BYO-key as trust. |
| 9 | Ingestion maintenance treadmill | **P2** | Buy/borrow ingestion; build only the drift-graph + agent brain. |
| 10 | Platform-consolidation whiplash | **P2** | Neutrality + local-first as the hedge (reduces, not eliminates). |
| 11 | OSS commoditization of primitives | **P2** | Moat is reused annotations (WHY) + earned accuracy, not the open format. |
| 12 | Postgres+CTE vs. graph DB at scale | **P3** | Ship Postgres now; swap behind the adapter only if traversal proves the bottleneck (M3). |
| 13 | Which ingestion sources first | **P3** | GitHub → Postgres+AWS Config → borrow the rest; prove one-product drift flow first (M3). |
| 14 | Agent-execution safety / sandboxing | **P3** | Impact-gated + drift-re-verified by construction; sandbox/policy design is M3. |
| 15 | Learn/Guide mode depth | **P3** | Start shallow; let return-usage justify depth. |
| 16 | Solo↔hosted format parity | **P3** | .planmap schema is the contract; hosted concerns additive only; round-trip test by M2. |

---

## 7. The one-sentence version

**PlanMap's survival depends on three unproven bets — that an editable graph beats markdown, that static-analysis-grounded Impact Analysis can be accurate enough to trust, and that a cross-layer, auto-populated drift map can stay fresh where every hand-maintained predecessor rotted — and the only honest position is to ship the narrowest slice that tests all three (Solo: auto-map + impact + drift on one TypeScript repo, local-first) before spending a single week on breadth.**
