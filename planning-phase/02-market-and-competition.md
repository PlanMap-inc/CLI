# PlanMap — Market & Competitive Landscape

> **Citation key.** This document synthesizes three research reports, each with its own numbered source list. To preserve every inline citation without collision, we namespace them: **`[R1:n]`** = Report 1 (SDD / AI plan-mode landscape, ~50 sources); **`[R2:n]`** = Report 2 (IDP / org-map / config-graph / agent-platform landscape, ~26 sources); **`[R3:n]`** = Report 3 (enterprise-knowledge / company-brain landscape, ~24 sources). All three source lists are reproduced in the consolidated **Sources** section. Uncertainty flags from the reports (**[unverified]**, **[directional]**, **[rumor]**) are carried through verbatim — we do not launder them.

PlanMap is a planning + governance + comprehension layer that sits **one layer above** coding agents (Claude Code, Copilot, Cursor). It never writes code; it decides what the code should be, hands scoped instructions to whatever agent the user has, and tracks intent vs. reality afterward via its four pillars — **Plan Graph** (Constellation and Feature Space zoom levels, with Business/Backend/Security Lenses), **Impact Analysis** (static parser decides *what* breaks, LLM only explains *why*), **Evolution Graph** (what actually exists, read from real code/infra), and **Learn/Guide mode**. Because of that positioning, PlanMap does not live in one market — it straddles two, and it competes against fragments of five distinct product categories. This document sizes both markets, maps every category bucket honestly (including the graveyard), positions PlanMap in a single comparison table, and states the strategic read.

---

## 1. Market sizing — two markets, one uncontested seam

PlanMap's wedge (Solo/Team editions) rides the **AI code-tools** market; its expansion (Org edition — the org-wide **Cross-layer drift stitch**) enters the **IDP / platform-engineering** market. Both are real, large, and growing >20% CAGR. Neither has a clean analyst line item for PlanMap's specific slice — which is simultaneously the opportunity (uncontested category) and the risk (buyers may lack a budget line).

### 1.1 AI code-tools market (the wedge rides this)

Four independent forecasters converge on the same shape — mid-single-digit-billions in 2025, growing >20% CAGR — but methodologies differ, so treat exact figures as **directional** [R1:6].

| Source | 2025 | 2026 | Out-year | CAGR |
|---|---|---|---|---|
| Mordor Intelligence [R1:1] | $7.37B | $9.35B | $29.96B (2031) | 26.2% |
| Business Research Co. / R&M [R1:2] | $7.65B | $9.46B | — | 23.7% |
| Grand View (code *assistants*) [R1:3] | $8.5B | $10.3B | $42.8B (2033) | 22.5% |
| Precedence Research [R1:4] | $7.93B | — | ~$91B (2035) | 27.7% |
| Grand View (code *tools*) [R1:5] | $4.86B (2023) | — | $26.03B (2030) | 27.1% |

**Consensus: ~$7.4–8.5B (2025), ~$9.4–10.3B (2026), >20% CAGR toward $26–43B by 2030–2033.** Critical caveat: these count code-*generation* tools. PlanMap is a governance/planning layer *adjacent* to generators, so this is the outer TAM, not PlanMap's serviceable market [R1:3].

**Derived SAM/SOM (analyst-derived, stated assumptions — not sourced forecasts).** Report 1 estimates ~25–30M professional developers globally (**[unverified]**) × ~90% AI-tool penetration [R1:9] ≈ ~22–27M AI-using seats; a realistic 10–20% subset that will pay for a planning/governance layer ≈ 3–5M seats; at comparable $12–20/seat/mo (Copilot Pro $10, Copilot Business $19, Kiro Pro $20 [R1:18][R1:30]) → **SAM ≈ $0.5–1.2B/yr** [R1]. Three-year SOM for a solo/tiny team, BYO-key, OSS-led: conservative 2,000–5,000 paid seats ≈ $0.4–0.9M ARR; ambitious ~20,000 seats ≈ ~$3.6M ARR — order-of-magnitude planning numbers, **not forecasts**, bound by distribution and conversion, not market size [R1].

### 1.2 IDP / platform-engineering market (the Org expansion enters this)

This is a **distinct** market from AI code-generation — the buyable "portal / catalog / platform" budget PlanMap's Org edition targets [R2:§5].

| Segment | 2025 | Out-year | CAGR | Note |
|---|---|---|---|---|
| Internal Developer Portal (narrow) [R2:19] | ~$1.8B | ~$4.95B (2030) | ~22.4% | one forecast |
| Internal Developer Portal (narrow) [R2:19] | $2.85B | $8.92B (2033) | ~15.2% | competing forecast |
| Platform Engineering + IDP (broad) [R2:19] | ~$8.24B | ~$23.9B (2030) | ~23.7% | Virtue/Mordor-class |

**Adoption tailwind (strongest datapoint):** Gartner's forecast that **80% of large software-engineering orgs will have platform teams by 2026** (up from 45% in 2022) is now reported as having materialized [R2:20].

**Critical counter-signal (the reason breadth-first is dangerous):** secondary analyses report **~60–70% of platform-engineering initiatives fail to deliver impact, and nearly half of platform teams are disbanded or restructured within ~18 months** [R2:20]. These specific failure percentages come from industry blogs citing Gartner-adjacent framing — treat as **[directional/unverified]**, not hard Gartner primary. Adjacent and blurring the lines: Software Engineering Intelligence Platforms (DX, Jellyfish), a Gartner-tracked neighbor now folding into portals [R2:24].

### 1.3 The category gap

PlanMap's actual category — "auto-populated, cross-layer intent-vs-reality drift graph that agents execute against" — has **no clean analyst market**. It is a slice of AI code-tools + a slice of IDP/DevEx/SDLC-governance. Uncontested (opportunity) but budget-line-less (risk): buyers may not yet know they should pay for it [R1:§3][R2:§5].

---

## 2. Competitive landscape by bucket

No single competitor ships PlanMap's exact loop (Plan Graph + static-analysis Impact Analysis + plan-anchored Drift + accumulated rationale, all agent-executable and cross-layer). Each owns a fragment. Below, organized by the five buckets PlanMap touches.

### 2.1 SDD / plan-mode (the wedge's direct neighborhood)

Spec-driven development crystallized as a named movement in 2025 (Sean Grove's "The New Code," GitHub Spec Kit, AWS Kiro, Tessl), validating PlanMap's "approve the plan before code" premise — while confirming giants are already in the adjacent space [R1:12][R1:13].

- **GitHub Spec Kit** — OSS `specify` CLI (`/specify → /plan → /tasks → /implement`); ~**90k–111k GitHub stars** in ~9 months, 30+ agent integrations [R1:12][R1:14]. Free, agent-agnostic, GitHub distribution. *Gap:* pure markdown artifacts, slash-command workflow — **no visual graph, no Impact Analysis, no Drift.** It defines the format war PlanMap must interoperate with (Data-as-truth dual-view: `.planmap` → 2D graph **and** auto-generated markdown), not fight.
- **AWS Kiro** — spec-first agentic IDE (VS Code fork) emitting `requirements.md` (EARS), `design.md`, `tasks.md`; **GA Nov 2025**, CLI + team features [R1:18][R1:19][R1:20]. Pricing Free/**Pro $20**/Pro+ $40/Power $200 on a credit model — with a **botched Aug 2025 pricing change ("wallet-wrecking")** that triggered backlash and refunds [R1:18][R1:21]. *Gap:* markdown not editable graph, no static-analysis Impact Analysis, Drift is not the product, and it's an **IDE you switch to** (lock-in) — the opposite of PlanMap's agnostic layer. The most credible large-vendor threat to PlanMap's SDD flank.
- **OpenSpec (Fission-AI)** — lightweight OSS SDD; proposals/specs/design/tasks as repo folders, 30+ assistants, no lock-in or API key [R1:22][R1:23]. Philosophically closest to PlanMap's local-first `.planmap` ethos. *Gap:* markdown, no graph, no Impact/Drift engine.
- **Cursor (Anysphere) — Plan Mode** — dominant AI IDE; **$29.3B valuation (Nov 2025), ~$2B ARR (early 2026)** [R1:27][R1:28]. Ships Plan Mode (agent writes a reviewable/editable plan before editing) [R1:29]. **This is the core commoditization risk:** "review a plan before coding" is now free and built-in. *Gap:* plan is chat/markdown-ish and ephemeral; no static-analysis impact graph, no persisted plan-anchored Drift, single-agent lock-in. (Rumored ~$50B round / SpaceX acquisition: **[rumor]**, excluded.)
- **Claude Code (Anthropic) — Plan Mode** — CLI agent with enforced read-only Plan Mode (Shift+Tab) [R1:33]; run-rate ~$1B (Nov 2025) → ~$2.5B (Feb 2026), driving Anthropic to ~$14B+ ARR [R1:32][R1:49]. **Primary integration target *and* competitor** — PlanMap sits explicitly above it. *Gap:* plan mode is a gate, not a persisted, visual, impact-aware graph; transcripts lose the *why*.
- **DeepWiki (Cognition/Devin)** — auto-generates wiki docs + Mermaid diagrams + RAG Q&A for any GitHub repo; free for public repos [R1:16][R1:17]; Cognition valued ~$10.2B [R1:36]. *Gap:* read-only *understanding*, not forward *planning*; no approval gate, no Impact Analysis on edits, no Drift-against-plan.
- **Tessl (Guy Podjarny/Snyk founder)** — "spec-as-source"; **$125M raised, ~$500–750M valuation (Nov 2024)** [R1:40][R1:41][R1:42]. Heavyweight capital, radical vision (code regenerable from spec). *Threat:* thematically overlapping and well-funded; if it ships approachable impact/visual tooling it competes for the "intent lives in the spec" narrative.
- **Also relevant — GitHub Copilot & Sourcegraph.** Copilot Free/$10/$19/$39 seat + AI-credit model; **Copilot Workspace ("plan then build") was sunset May 30, 2025**, folded into agent mode + Copilot Spaces [R1:30][R1:31] — even GitHub's own planning-first product didn't survive standalone. Sourcegraph repositioned Cody to enterprise-only ($59/user/mo, Free/Pro terminated Jul 2025), pushed individuals to Amp, then **split Amp into a separate company (Dec 2025)** [R1:37][R1:38][R1:39] — a code-intelligence leader thrashing on monetization.

**Bucket read:** Plan graphs and "plan mode" are becoming **table stakes** [R1:29][R1:33]. PlanMap's genuine differentiator here is not planning — it is **static-analysis-grounded Impact Analysis** (parser decides what breaks; LLM only narrates why), the anti-hallucination angle no incumbent leads with because they are incentivized to showcase LLM magic, not constrain it [R1:16].

### 2.2 IDP / software catalog (the Org edition's nearest neighbor)

The catalog is literally "a map of your software + ownership + dependencies," and every vendor here is bolting on an agent layer in 2025–2026 [R2:§1].

- **Backstage (Spotify → CNCF)** — the gravitational center; CNCF-incubating, 6th of 230+ in 2025 velocity, ~1,600 contributors, ~3,400 orgs [R2:1]. But it is a **framework, not a product**: populating the catalog means hand-authoring `catalog-info.yaml` across every repo, which "poses an adoption challenge even before the portal is launched" and leads to "catalogs that are never completed" [R2:8]. Roadie's 2025 State of Backstage: **56% cite upgrades as their #1 pain, 91% still self-host** [R2:5]. Quantified evidence for the "empty/stale catalog death."
- **Port** — the loudest signal: **$100M Series C at $800M valuation (Dec 2025, General Atlantic)** explicitly to become an "agentic AI hub"; ~$30/seat/mo Standard tier [R2:3]. Ships a **"Context Lake" + agent registry + MCP server** to catalog/govern/measure AI agents [R2:26]. **The closest competitor to PlanMap's "agents execute against the map" thesis — and now extremely well-capitalized.**
- **Cortex** — managed IDP; **$60M Series C (Sept 2024) at ~$470M post** [R2:2]; ships an MCP server, an AI Readiness Scorecard, and **"Magellan," an AI engine for automated catalog import** — using AI to solve its own catalog-population problem [R2:25].
- **OpsLevel** — IDP with "AI throughout"; **Tidra AI**, an MCP server, and a **Catalog Engine** to auto-build/maintain the catalog; modest funding (~$12M) [R2:4].
- **Atlassian Compass** — the enterprise distribution threat: **Free for 3 users, Standard $8/user/mo, Premium $25/user/mo**, bundled with Jira/Bitbucket/Opsgenie; real weapon is the Teamwork Graph (§2.5) [R2:6].
- **Roadie** — managed Backstage (~$3.7M raised); launched **Roadie Local** (free < 15 users) in 2025; publishes the State of Backstage report; positioning toward "engineering context for AI agents" [R2:5].

**Bucket read:** the universal 2025 pivot — **automated discovery / AI import** — is exactly PlanMap's proposed mechanism [R2:8][R2:§1]. Every incumbent concedes catalog population is "the hard part." PlanMap must be **auto-populated by construction**, never a human-maintained catalog. Differentiator vs. Port/Cortex: service-catalog-only, whereas PlanMap binds code + schema + cloud + CI.

### 2.3 Config-graph / CMDB (the "reality" half of Drift)

This category owns "what is *actually* running in prod, and does it match intent" [R2:§2].

- **AWS Config** — native baseline: records resource config, relationships, and **drift vs. desired state** via conformance packs; single-cloud, AWS-only, infra-level. **A data source PlanMap consumes via a Connector, not a competitor** [R2].
- **ServiceNow CMDB** — the 20-year cautionary tale: "almost every organization struggles to build and maintain a CMDB that is both accurate and useful," decaying into "stale, inconsistent, and untrustworthy data"; 2025 answer is **Now Assist for CMDB** (AI-assisted stale-record detection) [R2:10]. The definitive proof that a hand-maintained enterprise map decays and that AI is now retrofitted to keep it fresh.
- **Firefly** — cloud asset management built around **drift**: classifies every resource as *codified/unmanaged/drifted/ghost*, auto-generates Terraform/Pulumi; **$23M Series A (May 2024), ~$29.5M total** [R2:9]. **The closest existing product to PlanMap's "flag drift org-wide" claim — but scoped to infra/IaC, not code+features.**
- **CloudQuery** — OSS cloud asset inventory ELT'd into your Postgres (150+ providers); **$16M Series A (Jun 2025), ~$34.5M total** [R2:12].
- **Steampipe / Turbot Pipes** — live SQL query over cloud/APIs (150+ plugins, 2,000+ tables); managed tiers from free to ~$10/user/mo; shipped **MCP servers** in 2025 [R2:11].

**Bucket read:** "map everything prod uses" at the cloud-resource layer is **solved, commoditized, and MCP-enabled**. PlanMap's differentiation cannot be "we inventory AWS" — it must be the **code+feature+intent layer stitched to this infra reality** [R2:§2]. Steampipe (live query) vs. CloudQuery (ELT) is also the architectural fork PlanMap's Connectors must choose. Strategy: **buy/borrow ingestion** (CloudQuery/Steampipe/AWS Config as inputs), build the drift-graph brain.

### 2.4 Architecture intelligence (the visual/model layer — with a body count)

"A model of the system kept in sync with code" already exists as a product idea, with mixed commercial outcomes [R2:§3].

- **Multiplayer.app** — the most direct architecture-intelligence competitor: **"automatically discovers, tracks, and detects drift in your system architecture, dependencies and APIs by directly connecting to your infrastructure,"** with auto-generated service maps (GA 2025) [R2:23]. Essentially PlanMap's "living, drift-tracked map" for distributed systems — already shipping, but scoped to architecture/APIs, not the full code+schema+cloud+CI stitch.
- **Structurizr (Simon Brown, C4 model)** — the "diagrams-as-code" reference; DSL-defined model, many views, version-controlled; 2025 direction adds AI plugins [R2:14]. But fundamentally **human-authored intent, not auto-synced reality**.
- **IcePanel** — collaborative C4 modeling; "represent your architecture model as code and keep it in sync via API/SDK"; freemium; **again human-curated** [R2:13].
- **CodeSee (DEAD — the cautionary graveyard marker)** — interactive codebase maps, code tours, change-propagation visualization; ~$10M seed; **announced shutdown Feb 2024, absorbed by GitKraken May 2024** [R1:43][R1:44][R1:45][R2:22]. **Why it died:** strong free-user growth but inconsistent, slow revenue — visualization was a "nice to have" that didn't attach to a recurring, budget-owning workflow. **The direct lesson: a beautiful graph is not a business; the graph must be the entry point to a repeated action loop (approve → Impact Analysis → Drift).** This is also why PlanMap's Learn/Guide mode is generated from the live map and re-verified by Drift (so it cannot rot), unlike CodeSee's hand-authored tours.
- **Sourcegraph + the code-graph OSS wave** — org-wide code graph/search repositioned as "the organization-wide context AI coding tools lack" (Uber, Stripe, Dropbox); plus a wave of OSS code-knowledge-graph-for-agents projects (CodeGraph, GitNexus) mostly local-first + MCP [R2:17].

**Bucket read:** "architecture graph kept in sync with code" is validated as a need but has a **body count** — pure visualization doesn't retain; **executable/agent-consumable** graph is the live frontier.

### 2.5 Org-wide agent platforms (the fastest-moving, most dangerous)

The platform giants are converging on exactly PlanMap's "agents plan/execute against an org-wide graph" concept — PlanMap is **not early to the concept; it is entering a contested, capitalized race** [R2:§4].

- **GitHub Agent HQ** (Oct 2025) — "mission control" to orchestrate multiple vendors' agents across GitHub/VS Code/mobile/CLI; enterprise **control plane** for permissions/policy/audit; **`AGENTS.md`** config-as-code [R2:21]. GitHub owns the repos — the substrate of PlanMap's map.
- **AWS Bedrock AgentCore** (GA Oct 13, 2025) — production infra for enterprise agents (Runtime, Memory, Gateway zero-code MCP tool creation, Identity, Observability; VPC/PrivateLink) [R2:15]. The managed substrate PlanMap's Org edition can build on (Bedrock for data-residency) — or against which AWS competes.
- **Atlassian Teamwork Graph + Rovo** — a "living, evolving map of how work gets done" with **150B+ connections**, opened (Team '26) to any MCP-compatible third-party agent; **>90% of Atlassian enterprise cloud customers use Rovo** [R2:18]. **Conceptually the closest strategic analog to PlanMap's north star**, from a company with enormous enterprise distribution.
- **Cognition (Devin)** — capital/momentum benchmark: acquired Windsurf (~$250M, Jul 2025); **$400M at $10.2B valuation (Sept 2025)**; Devin ARR $1M (Sept 2024) → $73M (Jun 2025); reportedly ~$25B valuation talks (Apr 2026, **[rumor]**) [R2:16]. (The Windsurf dismemberment — Google licensed tech ~$2.4B, Cognition took the rest in 72 hours — is the definitive proof that building on one agent vendor is existentially risky [R1:34][R1:35][R1:50], reinforcing PlanMap's neutrality hedge.)

**Bucket read:** the "org-wide graph + agents execute against it" idea is pursued simultaneously by GitHub (code substrate), AWS (agent-infra substrate), Atlassian (work-graph substrate), and the funded IDPs (Port's Context Lake, Cortex's MCP). The whitespace none fully owns is the **specific stitch**: intent-vs-reality Drift across **code + schema + cloud + CI simultaneously**, executable by agents [R2:§4].

### 2.6 Enterprise knowledge / "company brain" (the horizon competitor set)

This bucket is one layer *out* from PlanMap's core — it answers "any question about the whole company," not "what should this code be." It matters because PlanMap's proposed Org-edition expansion (comms ingestion, non-technical readers) collides with the single hottest enterprise-AI category of 2026, and because the incumbents' shared blind spot is precisely PlanMap's wedge [R3:5][R3:6].

- **Glean** — the category king and the benchmark any "company brain" is measured against: **$150M Series F at a $7.2B valuation** (Jun 2025), and **$300M ARR crossed in May 2026** (up from ~$208M end-2025) [R3:1][R3:2][R3:3][R3:4]. Horizontal enterprise search + an agent platform ("Glean Agents") over Slack, Google Workspace, Microsoft 365, Salesforce and Jira, built on a permission-aware knowledge/context graph; its 2026 pitch has shifted to **AI cost reduction** (grounding agents in the context graph to cut token spend) [R3:3]. *Gap:* it indexes *documents and messages* and does RAG-over-text with permission trimming — it does not build or check a verified model of the *running system*.
- **Microsoft 365 Copilot** — the gravity well and IT-default: **20M paid seats (Apr 2026)**, **$30/user/mo** on annual commitment, used by >90% of the Fortune 500, inside a Microsoft AI business at a ~$37B annualized run rate (>$14B annualized Copilot revenue) [R3:12][R3:13]. For any horizontal "answer questions about your company" play, Copilot is the default that IT already owns.
- **Dust** — the most architecturally similar challenger: **$40M Series B (May 2026)**, a horizontal platform to "deploy, orchestrate and govern fleets of AI agents" over 100+ sources, positioned around "multiplayer AI" (~41,000 MAU across 3,000+ orgs, claimed zero churn in 2025) [R3:7][R3:8].
- **Sana (Workday)** — the category's M&A validation: **Workday acquired Sana for ~$1.1B** (signed Sep 2025, closed Nov 2025) to fold AI search + agents + learning into Workday's "front door for work" [R3:9][R3:10][R3:11].
- **Notion AI / Enterprise Search** — cross-app Q&A (Slack, Drive, Jira, GitHub, Teams, SharePoint) with a choice of GPT/Claude/Gemini models, riding Notion's existing workspace footprint [R3:14].
- **Guru** — repositioned from wiki to an "AI Agent Center" around *verified truth* (answers only from human-expert-approved content), with a Mar 2026 Slack MCP integration and usage-based AI-credit pricing [R3:15]. Notable because "verified" here still means *human-approved text*, not system-derived reality.
- **Comms-to-plan (intent signals, mostly a feature not a company).** **Linear Agent** (Mar 2026): @-mention Linear in Slack/Teams to create context-aware issues from a conversation; "Linear Intake"/"Asks" triage Slack into routed issues, with its CEO declaring "issue tracking dead" in favor of agentic operations [R3:16][R3:17]. **Height 2.0** rebuilt around autonomous PM — agents groom the backlog, post status, and plan sprints without prompting [R3:18]. *Gap:* these turn a conversation into a *ticket or summary*; none scope a proposed build *against a verified model of the existing system*.
- **Explain-code-to-non-engineers.** **Driver.ai** (YC) — a "compiler for codebase context" that pre-computes symbol-complete, deterministic understanding and serves it via MCP, deployed across 25+ enterprises over 200M+ LOC, explicitly naming the buyer pain ("support, product, and QA teams interrupt engineers because they can't access codebase knowledge themselves") [R3:20]. **Swimm** — AI explanations + auto-updating diagrams linked to code, deterministic-plus-AI, primarily developer onboarding [R3:19]. **DeepWiki** (Cognition/Devin) — conversational wiki docs for any GitHub repo (50k+ indexed), but its "non-technical" reach is really less-familiar *engineers* [R3:21]. Across all three the buyer/champion is still **engineering/platform**; non-technical users are beneficiaries and read-only consumers, not the economic buyer.
- **The YC "Company Brain" RFS (Summer 2026).** YC partner **Tom Blomfield** named "Company Brain" a priority idea: a system that "pulls knowledge out of all these fragmented sources, structures it, keeps it current, and turns it into an executable skills file for AI" — a living operational map of how a company actually works so agents act safely and consistently [R3:5][R3:6]. The sharpest external analysis argues the current entrants (Hyper, GBrain, et al.) "solve 40% of the problem" (retrieval) and miss the hard 60% — **determinism and governance**, i.e., a deterministic, versioned semantic layer under retrieval [R3:6]. A circulating **$50–100/employee/month** willingness-to-pay figure for a brain that answers *and executes* is *[unverified: originates from commentary, not a YC figure]* [R3:6]. YC's framing ("executable skills file," "living operational map," "act safely and consistently") is closer to PlanMap's DNA than to Glean's — validating, but also a signal that the space floods with well-pedigreed teams within 6–12 months.

**Bucket read:** this is a **HORIZON set** for PlanMap's Org edition — not a near-term competitor — and an **incumbent bloodbath** for the generic "RAG-over-Slack/email/docs" version (Glean at $300M ARR/$7.2B, Microsoft at 20M seats owning IT, Notion, Dust, and a Workday-owned Sana already occupy that ground with better connectors, distribution and trust) [R3:1][R3:3][R3:9][R3:12]. But every incumbent's ground truth is **human-authored text** that may be stale, contradictory or wrong; their shared blind spot is exactly PlanMap's wedge: a map **grounded in verifiable system reality (code + schema + cloud + CI) and EXECUTABLE**, right-by-construction and drift-checked — which is the unsolved "60%" (determinism, governance, auditable answers) the YC-space analysis flags [R3:6][R3:21]. Practically: "company brain" is a **north-star narrative, not a near-term product**, and comms (Slack/email/meetings) are **intent signals only** — never a co-equal source of truth that would dissolve the moat [R3:16].

---

## 3. Positioning — PlanMap vs. the field

| Product | Bucket | Plan artifact | Impact Analysis (*what* breaks) | Drift vs. intent | Auto-populated | Agent-agnostic | Local/git-native | Cross-layer (code+DB+cloud+CI) | Traction / funding |
|---|---|---|---|---|---|---|---|---|---|
| **PlanMap** | Planning/governance layer | **Editable Plan Graph + Lenses (2D)** | **Yes — static parser decides *what*, LLM explains *why*** | **Yes — vs approved Node, stores *why*** | **Yes (by construction)** | **Yes (VS Code + CLI + web)** | **Yes (`.planmap` in git)** | **Yes — the moat** | Pre-launch, solo/tiny team |
| GitHub Spec Kit | SDD (OSS) | Markdown + slash cmds | No | No | No | Yes (30+ agents) | Yes | No | ~90–111k stars [R1:12][R1:14] |
| AWS Kiro | SDD IDE | `requirements/design/tasks.md` | No (test-driven) | No | No | No (own IDE) | Files in repo | No | AWS; GA Nov 2025 [R1:19] |
| OpenSpec | SDD (OSS) | Markdown folders | No | No | No | Yes (30+) | Yes | No | OSS, growing [R1:22] |
| Cursor Plan Mode | Agent IDE | Plan Mode (editable) | No (LLM-guessed) | No | n/a | No (own IDE) | Partial | No | $29.3B val, ~$2B ARR [R1:27][R1:28] |
| Claude Code Plan Mode | CLI agent | Plan Mode (gate) | No | No | n/a | Anthropic models | Partial | No | ~$2.5B run-rate [R1:32] |
| DeepWiki | Understanding/docs | Auto-wiki + Mermaid | No | No | Yes (docs) | Reads any repo | No (hosted) | No | Cognition ~$10.2B [R1:36] |
| Tessl | Spec-as-source | Spec = source of truth | Partial (regenerate) | Implicit | Partial | Framework-level | Registry-based | No | $125M, ~$500–750M [R1:40][R1:41] |
| Backstage | IDP (OSS framework) | `catalog-info.yaml` | No | No | **No (hand-authored)** | Plugins | Self-host | Partial (services) | ~3,400 orgs; 56% cite upgrade pain [R2:1][R2:5] |
| Port | IDP (managed) | Catalog + Context Lake | No | No | Improving (AI import) | Yes (MCP + agent registry) | Hosted | Partial (services) | $100M @ $800M [R2:3] |
| Cortex | IDP (managed) | Catalog + Scorecards | No | No | Improving ("Magellan") | Yes (MCP) | Hosted | Partial (services) | $60M @ ~$470M [R2:2] |
| Firefly | Config-graph | IaC state | No | **Yes (infra only)** | **Yes** | API/CI | Hosted | **No (infra/IaC only)** | $23M Series A [R2:9] |
| AWS Config / CloudQuery / Steampipe | Cloud inventory | Resource records | No | Config drift (infra) | Yes | MCP (CQ/Steampipe) | CQ→your DB | No (cloud only) | CQ $34.5M; Firefly-adjacent [R2:11][R2:12] |
| Multiplayer | Architecture intel | Auto service map | No | **Yes (arch/APIs)** | **Yes** | Infra-connected | Hosted | Partial (arch+APIs) | GA 2025 [R2:23] |
| Structurizr / IcePanel | Architecture-as-code | C4 model (DSL) | No | No | **No (human-authored)** | API/SDK | Model in repo | No | Niche/freemium [R2:13][R2:14] |
| CodeSee (dead) | Visualization | Maps / tours | No | No | Partial | n/a | Partial | No | ~$10M seed; sunset 2024 [R1:44][R2:22] |
| GitHub Agent HQ | Org-wide agent platform | `AGENTS.md` | No | No | Uses repo graph | Multi-vendor | Repo-native | Code substrate | GitHub scale [R2:21] |
| Atlassian Teamwork Graph/Rovo | Org-wide agent platform | 150B-edge work graph | No | No | Yes (work data) | MCP-open | Hosted | Work/estate, not code drift | >90% enterprise Rovo use [R2:18] |

**The single-sentence position:** every competitor owns one column; **PlanMap is the only entry that ships static-analysis-grounded Impact Analysis + Drift-against-approved-intent + cross-layer stitch + neutrality together** — the combination is uncontested even though each part, in isolation, is not.

---

## 4. Strategic read

### 4.1 Real category vs. graveyard — both are true

The "org-wide living executable map" is demonstrably **buyable**: Port raised $100M/$800M on the agentic-portal thesis [R2:3], Cortex $60M [R2:2], Atlassian opened a 150B-edge work graph to agents [R2:18], Firefly and Multiplayer sell drift-tracked maps today [R2:9][R2:23], the platform-engineering market is $8B+ growing ~24% [R2:19]. It is also a **graveyard for the naive (hand-maintained) version**: ServiceNow CMDB is the 20-year monument to maps decaying into "untrustworthy data" [R2:10]; Backstage catalogs are "never completed" (56% cite upgrade pain, 91% self-host) [R2:5][R2:8]; ~half of platform teams are disbanded within ~18 months [R2:20]; CodeSee — a funded "map your whole codebase" startup — shut down [R1:44][R2:22]. **Verdict: real category, but the moat is freshness/accuracy — exactly where predecessors died.**

### 4.2 The whitespace — the Cross-layer drift stitch

The defensible whitespace no incumbent fully owns is binding **code + DB schema + cloud + CI into one Drift-checked, agent-executable graph**: Firefly = infra only; Port/Cortex = service catalog only; Multiplayer = architecture/APIs only; Sourcegraph = code graph only [R2:§4]. PlanMap's sharpest, most defensible wedge inside that stitch is **static-analysis-grounded Impact Analysis** — competitors' "what will this affect?" is either absent or LLM-guessed (hallucination-prone), and they *structurally under-invest* in constraining the LLM because they sell LLM magic [R1:§5]. Caveat, stated honestly: trustworthy cross-language static analysis is genuinely hard; accuracy is an **engineering moat you must earn**, and a few confidently-wrong "this will break" calls destroy trust faster than missing edges [R1:§7]. Complementary, harder-to-copy moats: **neutrality** (a vendor cannot credibly be "the neutral layer above all agents" while being an agent — a structural position incumbents are disincentivized to occupy) and the **behavioral moat** of accumulated, reused annotations (the *why*), since plain `.planmap` JSON in git is anti-lock-in by design — great for trust, weak for technical lock-in [R1:§5][R1:48]. The adjacent "company brain" category (Glean/Copilot/Dust and the YC RFS) is a **horizon, Org-edition concern rather than a near-term threat**, and the same grounded-in-verifiable-system-reality + executable stitch differentiates PlanMap there too — those incumbents do RAG over human-authored text, never a drift-checked model of the running system [R3].

### 4.3 Buy/borrow ingestion; build the drift-graph brain

An org-wide map needs connectors to GitHub org, multiple clouds, Jenkins, DB schemas, Bedrock usage — each a maintenance treadmill (Backstage's 56%-cite-upgrades pain [R2:5]; CloudQuery ($34.5M) and Firefly ($29.5M) exist *purely* to maintain ingestion [R2:9][R2:12]). **A tiny team cannot out-integrate funded ingestion specialists.** The realistic build: lean on existing sources (GitHub API + AWS Config/CloudQuery/Steampipe MCP + Jenkins API) as **inputs**, and build the thin, defensible layer — the intent-vs-reality diff + agent execution — on top [R2:§6(d)]. Buy/borrow ingestion; build the brain.

### 4.4 Land narrow, expand org-wide (bottom-up land, top-down expand)

The honest GTM is **land bottom-up, expand top-down**, matching the three-Edition engine:

1. **Solo (free, local-first)** — beachhead. Solo devs/indie hackers/OSS maintainers feel "AI wrote something that broke elsewhere" daily, adopt via VS Code Marketplace + npm CLI with no procurement, reachable through OSS/content. Comparable free tiers (Spec Kit, OpenSpec, DeepWiki) prove OSS-led SDD distribution works [R1:14][R1:22][R1:16]. **Avoid Kiro's credit-model backlash** [R1:21] — PlanMap is BYO-key and **never meters LLM tokens**; charge for the tool, turning "no LLM margin" into a trust selling point.
2. **Team (~$19/seat/mo)** — the "plan review" workflow buyer (team lead / senior eng): shared plans, approval workflow, Drift-in-CI, cross-repo Impact Analysis, agent dispatch to open an impact-gated PR. This is where the Plan Graph becomes a workflow, not a toy. Comparable anchors cluster at $10–20/seat [R1:18][R1:30].
3. **Org/Enterprise (custom)** — platform/DevEx budget owner (the $8B+ market [R2:19]), co-signed by whoever owns the brand-new 2026 **AI-agent-governance** budget Port is chasing [R2:3]. Here the org-wide Cross-layer drift stitch, SSO/RBAC, audit, agent-execution control plane, and org policy gates live — with VPC/Bedrock for data residency.

**Why narrow-first, not boil-the-ocean:** every piece of evidence says the org-wide map dies of staleness/emptiness before it delivers value, and top-down "boil-the-ocean map" sales is exactly where 18-month platform failures happen [R2:20]. The counter-argument is real — value and defensibility are both *emergent at org scale*, and the best-funded players (Port, Atlassian, GitHub) are racing to close the gap now [R2:§6(e)] — but a tiny team cannot build fresh org-wide ingestion faster than $30M-funded specialists. So: **land a single-repo/single-product wedge that is undeniably accurate and agent-executable, earn trust, then expand outward** — the same path Port and Cortex actually walked.

**Bottom line.** The category is real and hot, the giants are converging, and the graveyard is real too. PlanMap's only viable path is an **auto-populated, freshness-by-construction, cross-layer (code + schema + cloud + CI) Drift graph that agents execute against** — landed narrow (Impact Analysis as the hero, Plan Graph as the on-ramp), expanded org-wide — and **never a human-maintained catalog sold top-down.** The metric that proves the moat is behavioral: do teams *keep and reuse* their annotations (the *why*) [R1:§5][R1:48].

---

## Sources

This document synthesizes three research reports. Citations above are namespaced **`[R1:n]`** (Report 1), **`[R2:n]`** (Report 2), and **`[R3:n]`** (Report 3); all three source lists are reproduced verbatim below.

### Report 1 — SDD / AI plan-mode landscape (`[R1:n]`)
*PlanMap — Market & Competitive Research Report, 2026-07-17, ~50 sources.*

1. Mordor Intelligence — AI Code Tools Market. https://www.mordorintelligence.com/industry-reports/artificial-intelligence-code-tools-market
2. The Business Research Company — AI Code Tools Global Market Report. https://www.thebusinessresearchcompany.com/report/artificial-intelligence-ai-code-tools-global-market-report
3. Grand View Research — AI Code Assistants Market Report. https://www.grandviewresearch.com/industry-analysis/ai-code-assistants-market-report
4. Precedence Research — AI Code Tools Market. https://www.precedenceresearch.com/ai-code-tools-market
5. Grand View Research — AI Code Tools Market Report. https://www.grandviewresearch.com/industry-analysis/ai-code-tools-market-report
6. Hostinger — Vibe coding statistics 2026 (secondary aggregate). https://www.hostinger.com/blog/vibe-coding-statistics/
7. GitClear — AI Copilot Code Quality 2025 Research. https://www.gitclear.com/ai_assistant_code_quality_2025_research
8. GitClear — AI Copilot Code Quality 2025 (PDF). https://gitclear-public.s3.us-west-2.amazonaws.com/GitClear-AI-Copilot-Code-Quality-2025.pdf
9. DORA — State of AI-assisted Software Development 2025. https://dora.dev/dora-report-2025/
10. Google Cloud — Announcing the 2025 DORA Report. https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report
11. InfoQ — DORA Report Finds AI Is an Amplifier, Trust Remains Low. https://www.infoq.com/news/2025/09/dora-state-of-ai-in-dev-2025/
12. Martin Fowler — Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl. https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
13. GitHub Blog — Spec-driven development with AI: open source toolkit. https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
14. GitHub — Spec Kit repository. https://github.com/github/spec-kit
15. Augment Code — Best Spec-Driven Development Tools. https://www.augmentcode.com/tools/best-spec-driven-development-tools
16. Cognition — DeepWiki: AI docs for any repo. https://cognition.com/blog/deepwiki
17. Devin Docs — DeepWiki. https://docs.devin.ai/work-with-devin/deepwiki
18. Kiro — Pricing. https://kiro.dev/pricing/
19. SiliconANGLE — AWS launches Kiro into general availability. https://siliconangle.com/2025/11/17/aws-launches-kiro-general-availability-team-features-cli-support/
20. Forbes — AWS Launches Kiro, A Specification-Driven Agentic IDE. https://www.forbes.com/sites/janakirammsv/2025/07/15/aws-launches-kiro-a-specification-driven-agentic-ide/
21. The Register — AWS pricing for Kiro dev tool 'a wallet-wrecking tragedy'. https://www.theregister.com/2025/08/18/aws_updated_kiro_pricing/
22. GitHub — Fission-AI/OpenSpec. https://github.com/Fission-AI/openspec
23. OpenSpec — official site. https://openspec.dev/
24. PitchBook — Augment Code company profile. https://pitchbook.com/profiles/company/530746-75
25. redreamality — Why is Augment Code worth $1 billion? https://redreamality.com/garden/questions/augment-code-investor-breakdown/
26. Augment Code — Factory AI vs Augment Cosmos. https://www.augmentcode.com/tools/factory-ai-vs-augment-cosmos
27. CNBC — Cursor raises $2.3B at $29.3B valuation. https://www.cnbc.com/2025/11/13/cursor-ai-startup-funding-round-valuation.html
28. TechCrunch — Cursor's Anysphere nabs $9.9B valuation, soars past $500M ARR. https://techcrunch.com/2025/06/05/cursors-anysphere-nabs-9-9b-valuation-soars-past-500m-arr/
29. Learn Cursor — Agent Plan Mode. https://www.learncursor.dev/learn/cursor-agents/agent-plan-mode
30. GitHub — Copilot Plans & pricing. https://github.com/features/copilot/plans
31. Java Code Geeks — GitHub Copilot Workspace & The Agentic Era. https://www.javacodegeeks.com/2026/02/github-copilot-workspace-the-agentic-era.html
32. SaaStr — Anthropic Hits $14B ARR (Claude Code run-rate). https://www.saastr.com/anthropic-just-hit-14-billion-in-arr-up-from-1-billion-just-14-months-ago/
33. ClaudeLog — Claude Code Plan Mode mechanics. https://claudelog.com/mechanics/plan-mode/
34. CNBC — Cognition to buy Windsurf after Google poached CEO. https://www.cnbc.com/2025/07/14/cognition-to-buy-ai-startup-windsurf-days-after-google-poached-ceo.html
35. TechCrunch — Cognition acquires Windsurf. https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/
36. CNBC — Cognition valued at $10.2B two months after Windsurf purchase. https://www.cnbc.com/2025/09/08/cognition-valued-at-10point2-billion-two-months-after-windsurf-.html
37. Sourcegraph — Changes to Cody Free, Pro, and Enterprise Starter plans. https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans
38. Sourcegraph — Pricing. https://sourcegraph.com/pricing
39. WeavAI — Sourcegraph Cody Review 2026 ($59/mo enterprise; Amp). https://weavai.app/blog/en/2026/04/30/sourcegraph-cody-review-2026-enterprise-ai-at-59-mo/
40. TechCrunch — Tessl raises $125M at $500M+ valuation. https://techcrunch.com/2024/11/14/tessl-raises-125m-at-at-500m-valuation-to-build-ai-that-writes-and-maintains-code/
41. Fortune — Tessl worth ~$750M after new funding. https://fortune.com/2024/11/14/tessl-funding-ai-software-development-platform/
42. Tessl — Announcing Our Series A for AI Native Software Development. https://tessl.io/blog/announcing-our-series-a-for-ai-native-software-development/
43. GlobeNewswire — CodeSee Announces $7M in New Funding. https://www.globenewswire.com/news-release/2022/01/20/2370076/0/en/CodeSee-Announces-7M-in-New-Funding-to-Address-Rising-Demand-for-Code-Visualization-and-Understanding.html
44. Koalr — CodeSee Alternatives After the GitKraken Acquisition. https://koalr.com/blog/codesee-alternatives
45. Shanea Leven (LinkedIn) — CodeSee closes its doors. https://www.linkedin.com/feed/update/urn:li:activity:7163970333912289281
46. GitHub — sauremilk/drift: Detect architectural erosion from AI-generated code. https://github.com/sauremilk/drift
47. GitHub Marketplace — Drift: Architectural Erosion Check (Action). https://github.com/marketplace/actions/drift-architectural-erosion-check
48. O'Reilly Radar — The AI Agents Stack (2026 Edition). https://www.oreilly.com/radar/the-ai-agents-stack-2026-edition/
49. VentureBeat — Anthropic hits $30B revenue run rate. https://venturebeat.com/technology/anthropic-says-it-hit-a-30-billion-revenue-run-rate-after-crazy-80x-growth
50. DeepLearning.AI (The Batch) — Google, Cognition Carve Up Windsurf. https://www.deeplearning.ai/the-batch/google-cognition-carve-up-windsurf-after-openais-failed-3b-acquisition-bid

### Report 2 — IDP / org-map / config-graph / agent-platform landscape (`[R2:n]`)
*PlanMap — Adjacent Competitive Landscape, 2026-07-17, ~26 sources.*

1. CNCF — Backstage project status & 2025 velocity; The New Stack. https://www.cncf.io/blog/2026/02/09/what-cncf-project-velocity-in-2025-reveals-about-cloud-natives-future/ ; https://thenewstack.io/five-years-in-backstage-is-just-getting-started/
2. Cortex — "Our Series C — $60M in New Funding"; FinSMEs. https://www.cortex.io/post/announcing-series-c ; https://www.finsmes.com/2024/09/cortex-raises-60m-in-series-c-funding.html
3. Port — TechCrunch "$100M at $800M valuation"; SiliconANGLE; Port pricing. https://techcrunch.com/2025/12/11/port-raises-100m-at-800m-valuation-to-take-on-spotifys-backstage/ ; https://siliconangle.com/2025/12/11/port-nets-100m-turn-developer-portal-agentic-ai-hub/ ; https://www.port.io/pricing
4. OpsLevel — AI page, pricing, Crunchbase. https://www.opslevel.com/ai ; https://www.opslevel.com/pricing ; https://www.crunchbase.com/organization/opslevel
5. Roadie — "2025 State of Backstage Report"; cost analysis; Roadie Local. https://roadie.io/blog/the-2025-state-of-backstage-report/ ; https://roadie.io/blog/backstage-how-much-does-it-really-cost/ ; https://roadie.io/blog/roadie-local-self-hosted-backstage-ready-in-minutes/
6. Atlassian Compass — pricing. https://www.atlassian.com/software/compass/pricing ; https://community.atlassian.com/forums/Compass-articles/Announcing-Compass-pricing-Free-software-catalog-for-all/ba-p/2334632
7. Configure8 — company profile (Taloflow, CB Insights). https://www.taloflow.ai/guides/products/configure8 ; https://www.cbinsights.com/company/configure8
8. Software-catalog population problem — Port guide; OpsLevel Catalog Engine; Roadie. https://www.port.io/guide/software-catalog ; https://www.opslevel.com/resources/the-catalog-engine ; https://roadie.io/blog/3-strategies-for-a-complete-software-catalog/
9. Firefly — product/drift classification; FinSMEs "$23M Series A." https://www.firefly.ai/product ; https://www.finsmes.com/2024/05/firefly-raises-23m-in-series-a-funding.html
10. ServiceNow CMDB accuracy — ServiceNow Community; RapDev "Dirty CMDB"; Now Assist for CMDB. https://www.servicenow.com/community/itom-forum/concerns-about-data-accuracy-and-completeness-improve-the/m-p/3025483 ; https://www.rapdev.io/blog/dirty-cmdb-clean-it-up ; https://store.servicenow.com/store/app/b9fe6f2e1b646a50a85b16db234bcba7
11. Steampipe / Turbot Pipes — project & managed service. https://steampipe.io/ ; https://github.com/turbot/steampipe ; https://turbot.com/pipes
12. CloudQuery — GitHub; Tracxn ("$16M Series A, Partech; ~$34.5M total"). https://github.com/cloudquery/cloudquery ; https://tracxn.com/d/companies/cloudquery/__n_quLfKYSxVYqJAGddpx6L81mF3TqW8PMWllVtc34RQ
13. IcePanel — C4 modeling, model-as-code sync. https://icepanel.io/c4-model ; https://icepanel.io/pricing
14. Structurizr / C4 model — Simon Brown. https://structurizr.com/ ; https://simonbrown.je/
15. Amazon Bedrock AgentCore — AWS product; GA analysis; Gateway blog. https://aws.amazon.com/bedrock/agentcore/ ; https://www.ernestchiang.com/en/posts/2025/amazon-bedrock-agentcore-generally-available/ ; https://aws.amazon.com/blogs/machine-learning/introducing-amazon-bedrock-agentcore-gateway-transforming-enterprise-ai-agent-tool-development/
16. Cognition / Devin — CNBC "$10.2B valuation"; TechCrunch Windsurf; VentureBeat "$400M raise." https://www.cnbc.com/2025/09/08/cognition-valued-at-10point2-billion-two-months-after-windsurf-.html ; https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/ ; https://venturebeat.com/programming-development/cognition-follows-windsurf-acquisition-with-usd400m-fundraise-showing-strong
17. Sourcegraph — "Why code search at scale is essential"; code-graph OSS wave. https://sourcegraph.com/blog/why-code-search-at-scale-is-essential-when-you-grow-beyond-one-repository ; https://github.com/colbymchenry/codegraph
18. Atlassian Rovo / Teamwork Graph — Atlassian blog; SiliconANGLE (Team '26). https://www.atlassian.com/blog/company-news/rovo-team-26 ; https://siliconangle.com/2026/05/06/atlassian-opens-teamwork-graph-pushes-rovo-agentic-execution-team-26/
19. Market sizing — Mordor Intelligence; Virtue Market Research; MarketIntelo. https://www.mordorintelligence.com/industry-reports/platform-engineering-and-internal-developer-platform-idp-market ; https://virtuemarketresearch.com/report/platform-engineering-internal-developer-platform-idp-market ; https://marketintelo.com/report/internal-developer-portal-market
20. Gartner platform-engineering adoption (80% by 2026) & failure-rate commentary. https://www.gartner.com/en/infrastructure-and-it-operations-leaders/topics/platform-engineering ; https://www.signisys.com/blog/gartner-says-80-of-software-orgs-will-have-platform-teams-by-2026/ ; https://byteiota.com/platform-engineering-80-adoption-70-fail-within-18-months/
21. GitHub Agent HQ — GitHub Blog; VentureBeat. https://github.blog/news-insights/company-news/welcome-home-agents/ ; https://venturebeat.com/ai/githubs-agent-hq-aims-to-solve-enterprises-biggest-ai-coding-problem-too
22. CodeSee / GitKraken acquisition — FinSMEs; GitKraken blog. https://www.finsmes.com/2024/05/gitkraken-acquires-codesee.html ; https://www.gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee
23. Multiplayer.app — auto-discovery & architecture drift; GA launch. https://www.multiplayer.app/system-dashboard/ ; https://www.multiplayer.app/blog/multiplayer-launches-ga-with-new-system-architecture-observability-features/
24. Gartner Peer Insights — Software Engineering Intelligence Platforms. https://www.gartner.com/reviews/market/software-engineering-intelligence-platforms
25. Cortex AI — MCP, AI Readiness Scorecards, "Magellan" catalog auto-import. https://docs.cortex.io/get-started/cortex-ai-assistant/mcp ; https://docs.cortex.io/solutions/ai-readiness/configure ; https://www.cortex.io/products/scorecard
26. Port AI agents — agent management/Context Lake/MCP. https://docs.port.io/agent-management/overview/ ; https://www.port.io/platform/ai-agents

### Report 3 — Enterprise knowledge / company-brain landscape (`[R3:n]`)
*PlanMap — The "Company Brain" Adjacency: enterprise work-AI / comms-driven planning / explaining systems to non-engineers, 2026-07-17, ~24 sources.*

1. Glean — "Glean raises $150M Series F at $7.2B valuation." glean.com/blog/glean-series-f-announcement
2. TechCrunch — "Enterprise AI startup Glean lands a $7.2B valuation" (2025-06-10). techcrunch.com/2025/06/10/enterprise-ai-startup-glean-lands-a-7-2b-valuation/
3. TechCrunch — "Glean's top line crosses $300M…" (2026-05-28). techcrunch.com/2026/05/28/gleans-top-line-crosses-300m-as-ai-budget-cutting-becomes-its-major-selling-point/
4. ValueAdd VC — "Glean Valuation 2026: $7.2B and $300M ARR" (cites $208M end-2025). valueaddvc.com/blog/glean-valuation-revenue-2026-300m-arr-enterprise-ai-search
5. Y Combinator — Requests for Startups ("Company Brain," Tom Blomfield, Summer 2026). ycombinator.com/rfs
6. Colrows — "YC's Company Brain RFS: What Hyper, GBrain, and the Competition Got Right (and Wrong)." colrows.com/blogs/yc-company-brain-rfs/
7. SiliconANGLE — "Multiplayer AI startup Dust raises $40M…" (2026-05-18). siliconangle.com/2026/05/18/multiplayer-ai-startup-dust-swipes-40m-funding…
8. Dust — "2025 Dust Product Update Recap" / SaaStr AI App of the Week (usage metrics). dust.tt/blog/2025-dust-product-update-recap ; saastr.com/saastr-ai-app-of-the-week-dust/
9. Workday Newsroom — "Workday Signs Definitive Agreement to Acquire Sana" (2025-09-16); completion 2025-11-04. newsroom.workday.com/2025-09-16-Workday-Signs-Definitive-Agreement-to-Acquire-Sana
10. Orrick — "Workday to Acquire Sana for $1.1 Billion." orrick.com/en/News/2025/09/Workday-to-Acquire-Sana-for-1-Billion
11. CIO — "Workday integrates Sana to turn its enterprise apps into agentic execution engines." cio.com/article/4146511/…
12. GetPanto — "Microsoft Copilot Statistics 2026: Users, Adoption & Revenue" (20M seats, $30/user, revenue). getpanto.ai/blog/microsoft-copilot-statistics
13. Microsoft Community Hub — "What's New in Microsoft 365 Copilot | January 2026." techcommunity.microsoft.com/blog/microsoft365copilotblog/…/4488916
14. Notion — "Enterprise Search / AI" product & help pages (connectors, model choice, plans). notion.com/product/enterprise-search ; notion.com/help/enterprise-search
15. Guru / TechPlusTrends — "Guru vs Glean 2026: Why Verified AI Beats Enterprise Search" (verified truth, Slack MCP, credit pricing). techplustrends.com/guru-vs-glean-2026-enterprise-ai-knowledge-tools/ ; getguru.com/alternatives/glean
16. Linear — "Introducing Linear Agent" changelog (2026-03-24) & Slack/Intake docs. linear.app/changelog/2026-03-24-introducing-linear-agent ; linear.app/intake
17. DevClass — "Linear moves sideways to agentic AI as CEO declares issue tracking dead" (2026-03-27). devclass.com/development/2026/03/27/…
18. BuildBetter — "Linear AI Agents: 2026 Guide + 5 Alternatives" (incl. Height 2.0 autonomous PM). blog.buildbetter.ai/linear-ai-agents-2026-guide-5-alternatives-for-engineering-teams/
19. Swimm — product & "Explain codebase" docs (code-linked AI docs, deterministic+AI). swimm.io ; docs.swimm.io/explore-codebase/explain-codebase/
20. Driver.ai — homepage, product & YC profile ("compiler for codebase context"; support/product/QA pain; 25+ enterprises, 200M+ LOC). driver.ai ; ycombinator.com/companies/driver
21. DeepWiki (Cognition/Devin) — deepwiki.com ; cognition.com/blog/deepwiki ; docs.devin.ai/work-with-devin/deepwiki (50k+ repos, conversational docs)
22. Precedence Research — "Enterprise Search Market Size to Hit USD 12.71 Billion by 2035" ($5.34B 2025, 9.05% CAGR). precedenceresearch.com/enterprise-search-market
23. Mordor Intelligence — "Enterprise Search Market" ($6.8B 2025 → $11.15B 2030 @10.3%); Technavio corroboration. mordorintelligence.com/industry-reports/enterprise-search-market
24. Fortune Business Insights / Grand View Research — Knowledge Management Software Market ($23.2B 2025 → $74B 2034 @13.8%; alt $16.22B 2026 → $37.64B 2031 @18.3%). fortunebusinessinsights.com/knowledge-management-software-market-110376 ; grandviewresearch.com/industry-analysis/knowledge-management-software-market-report

---

*Confidence & caveats. Market-firm TAM figures (both markets) are directional and vary by methodology (§1). SAM/SOM are analyst-derived with stated assumptions, not sourced forecasts; developer-population inputs are **[unverified]**. Platform-engineering failure rates (~60–70% fail, ~half of teams disbanded in ~18 months) come from Gartner-adjacent industry blogs — **[directional/unverified]**. Some traction figures (later Cursor valuations, Cognition's ~$25B talks, a rumored SpaceX acquisition) circulate but are **[rumor]** and were excluded from analysis. The strongest primary evidence throughout is DORA 2025, GitClear 2025, CNCF/Roadie Backstage data, and named funding rounds.*
