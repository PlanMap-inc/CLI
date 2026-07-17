# PlanMap — Planning Phase

> **This is the index for the PlanMap planning-phase document set (2026-07-17).** It contains a one-page executive summary followed by a linked table of contents for the seven planning documents. Every doc in this set is consistent with the canonical brief; where a figure appears it is drawn from one of three market-research reports (SDD/plan-mode; IDP/org-map; company-brain — all committed under `planning-phase/research/`) and carries that report's uncertainty flags (`[unverified]`, `[directional]`, `[rumor]`) verbatim.

---

## Executive summary

**PlanMap is the self-populating map of how your software actually works — across code, data, and cloud — that catches when reality drifts from what you approved, and lets AI agents act on it.** It is a planning + governance + comprehension layer that sits **one layer above** coding agents (Claude Code, Copilot, Cursor). It never writes code itself: it decides what the code *should* be, hands a precise scoped instruction to whatever agent the developer already uses, and then tracks intent-versus-reality afterward by reading the real system.

**The problem.** The AI code-tools market is large and fast-growing (~$7.4–8.5B in 2025, >20% CAGR [directional]), but PlanMap targets the *wreckage generation leaves behind*. DORA 2025 documents an instability paradox — throughput up, delivery stability falling — with ~30% of developers reporting little/no trust in AI code and >60% finding AI-introduced errors after deployment; GitClear's 211M-line study shows duplication up ~8× and refactoring collapsing from 25% to <10%. As agents write more code faster, the *why* behind architectural decisions evaporates into ephemeral chat transcripts. That lost intent is the gap PlanMap names.

**The moat.** Planning ("review a plan before the agent codes") is becoming table stakes — it ships free inside Cursor, Claude Code, and Copilot. The defensible whitespace is the **cross-layer intent-vs-reality drift stitch**: binding code + DB schema + cloud + CI into ONE drift-checked, agent-executable graph, where drift is measured against an *explicitly human-approved* plan node and the stored annotation preserves the *why*. Every incumbent owns exactly one layer (Firefly = infra only; Port/Cortex = service catalog only; Multiplayer = architecture/APIs only; Sourcegraph = code graph only). The stitch is the core of a **five-part moat**; four reinforcing components compound it: **auto-population / freshness-by-construction** (the wedge — hand-maintained maps are a graveyard: ServiceNow CMDB, Backstage, CodeSee); **neutrality** (agent/IDE-agnostic, local-first, BYO-key — a position agent vendors are structurally disincentivized to hold); **earned static-analysis accuracy** (a parser decides *what* is affected, the LLM only explains *why* — the anti-hallucination stance); and the **behavioral moat** of accumulated, reused annotations.

**The four pillars.** (1) **Plan Graph** — the intended architecture, editable and zoomable (Constellation → Feature Space; Business/Backend/Security lenses); AI drafts, human edits, human wins. (2) **Impact Analysis** (the hero) — when a node is edited, show what breaks and why, with uncertainty always visible; a static parser decides WHAT, the LLM only explains WHY. (3) **Evolution Graph** — what actually exists, derived by reading real code/infra, with nodes flagged `drifted`/`error` when code diverges from approved intent. (4) **Learn/Guide mode** — a pedagogical view of the same live map that cannot rot because drift re-verifies it.

**The editions.** One engine, three editions, sold **land bottom-up, expand top-down**:

| | **Solo** | **Team** | **Org / Enterprise** |
|---|---|---|---|
| Who | Individual devs, indie hackers, OSS maintainers | Startups / small teams (~2–30) | Platform / DevEx teams and enterprises |
| Store | Local-first `LocalStore` (SQLite/JSON in `.planmap`) | Hosted `CloudStore` (Postgres) or self-host | Hosted or VPC/on-prem (Bedrock in their AWS) |
| Connectors | git / code (TypeScript-JS first) | + GitHub-org, Postgres/DB, basic AWS, Jenkins | Full suite (DB / AWS / Jenkins / Bedrock usage) |
| Headline | Auto-map + Impact + Drift on your own repo | Cross-repo map & impact, shared plans, approvals, drift-in-CI | Org-wide cross-layer drift stitch + agent-execution control plane + governance |
| Price | **$0** (free, BYO-key) | **~$19/seat/mo** (directional) | **Custom** |

Editions are entitlement/deployment configurations of the same core, not separate products. The mechanism: a **Storage adapter** (LocalStore / CloudStore, identical schema) + a pluggable **Connector** interface + tier **Entitlements**. BYO-key and **never metered on tokens** at every tier (turning "no LLM margin" into a trust selling point).

**The milestone plan.** Built platform-ready from day one, shipped Solo-first:

- **M1 — Solo edition (local-first):** the auto-map + Impact Analysis + Drift engine + storage adapter + git/TypeScript connector + web UI + CLI. Proves the core loop beats chat + markdown on one developer's own repo.
- **M2 — Team edition:** hosted store (CloudStore) + GitHub-org multi-repo + collaboration/approvals + drift-in-CI + first cross-layer connector + impact-gated agent PRs. Proves the loop survives a team and gates in CI.
- **M3 — Org edition:** cross-layer connectors (DB/AWS/Jenkins/Bedrock) + the org-wide cross-layer drift stitch + agent-execution control plane + governance/SSO/audit + data residency. Proves the moat at estate scale.

Learn/Guide mode ships as a view + entitlement across all three.

**North-star horizon (post-M1, roadmap lane — not Milestone 1).** Beyond the three milestones: Slack/email as *intent signals* feeding **proactive planning** (PlanMap drafts plans from where work is actually decided), a non-technical **Stakeholder view** (extending Learn/Guide mode for sales/PM/execs), and the **"company brain"** framing — a *grounded, executable* system-of-record, distinct from RAG-over-docs brains (Glean, Microsoft 365 Copilot, Dust) because it reads verified system reality and acts on it. Detailed in docs 03 & 06; deliberately **not** in M1.

**The honest bottom line.** PlanMap is entering a category that is simultaneously real, hot, funded — and a documented graveyard. Survival rests on three unproven bets: that an editable graph beats markdown, that static-analysis-grounded Impact Analysis can be accurate enough to trust, and that a cross-layer auto-populated drift map can stay fresh where every hand-maintained predecessor rotted. The only honest position is to ship the narrowest slice that tests all three (M1: Solo, local-first, one TypeScript repo) before spending a week on breadth.

---

## Table of contents

| # | Document | In one line |
|---|---|---|
| 00 | **[README](./00-README.md)** (this doc) | Executive summary and the index to the planning-phase set. |
| 01 | **[Vision & Thesis](./01-vision-and-thesis.md)** | The north star — the problem (lost architectural intent), the precise five-part moat, the four pillars, and why the window is open now. |
| 02 | **[Market & Competitive Landscape](./02-market-and-competition.md)** | Sizes both markets PlanMap straddles, maps every competitor by bucket (including the graveyard), and positions PlanMap in one comparison table. |
| 03 | **[Product, Editions & GTM](./03-product-editions-and-gtm.md)** | The three-edition matrix, Learn/Guide mode across tiers, the one-engine mechanism, the land-bottom-up/expand-top-down motion, pricing, and success metrics. |
| 04 | **[Architecture](./04-architecture.md)** | How PlanMap is built — the core-first monorepo, six subsystems, the Storage adapter and Connector interface, and the Impact/Drift/LLM engines. |
| 05 | **[Data Model & Graph](./05-data-model-and-graph.md)** | The `.planmap` store as the single source of truth — entity hierarchy, Node/Edge schema, dual-view projection (graph + markdown), and drift detection. |
| 06 | **[Roadmap & Milestones](./06-roadmap-and-milestones.md)** | The locked M1→M2→M3 sequence, the M1 detailed build order, the anti-catalog rule, and the validation experiments that settle the core bet. |
| 07 | **[Risks & Open Questions](./07-risks-and-open-questions.md)** | The adversarial document — every way PlanMap dies, triaged P0–P3, each with a one-line executable mitigation. |

**Implementation spec.** The concrete, buildable design for Milestone 1 lives outside this set at [`docs/superpowers/specs/2026-07-17-planmap-design.md`](../docs/superpowers/specs/2026-07-17-planmap-design.md) — it is what an implementation-planning step executes against.
