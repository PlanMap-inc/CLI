# PlanMap — Product, Editions & GTM

> **One-liner.** PlanMap is "the self-populating map of how your software actually works — across code, data, and cloud — that catches when reality drifts from what you approved, and lets AI agents act on it."
>
> **What this document covers.** How the single PlanMap engine is packaged into three editions (Solo / Team / Org), how Learn/Guide mode rides across all three, the mechanism that lets one engine serve all three, the go-to-market motion (land bottom-up, expand top-down), and the success metrics that tell us whether the moat is actually forming.
>
> **What it is NOT.** PlanMap is not a coding agent, code editor, model host, hand-maintained catalog, or a pure visualization tool. It is a planning + governance + comprehension layer that sits **one layer above** the coding agents the user already has (Claude Code, Copilot, Cursor). It decides what the code should be, hands scoped instructions to whatever agent the user runs, and tracks intent vs. reality afterward. It never writes code itself.

---

## 1. The three-edition matrix

There is **one engine, three editions**. The editions are not three products — they are three entitlement/deployment configurations of the same core (auto-map + Impact Analysis + Drift + Storage adapter + Connector interface). The progression mirrors the buyer progression: solo dev → team lead → platform/DevEx → enterprise.

| | **Solo** | **Team** | **Org / Enterprise** |
|---|---|---|---|
| **Who** | Individual devs, indie hackers, OSS maintainers | Startups / small teams (~2–30 people) | Platform / DevEx teams and enterprises |
| **Scope** | Their own repo(s) | A product = several repos | The whole estate (all products, repos, clouds, CI, Bedrock usage) |
| **Deploy / Store** | Local-first: `LocalStore` = SQLite/JSON in a `.planmap` store; CLI + VS Code + local web; **no account** | Hosted central store (or self-host): `CloudStore` = Postgres | Hosted **or** VPC/on-prem for data residency (Bedrock runs in *their* AWS) |
| **Connectors** | git / code — **TypeScript-JS first** (via ts-morph) | Adds GitHub-org, Postgres/DB schema, basic AWS, Jenkins | Full connector suite (DB / AWS / Jenkins / Bedrock usage) |
| **Hero features** | Auto-map, Plan Graph + generated markdown, Impact Analysis, Drift on their own code, scoped agent handoff, Learn/Guide mode | Adds cross-repo map & impact, shared plans, approval workflow, drift-in-CI, roles | Adds the org-wide **cross-layer drift stitch** (code + schema + cloud + CI in one graph) |
| **Agent execution** | Scoped agent handoff: PlanMap generates precise, impact-gated instructions; the user's own agent implements | Dispatch an agent to open an **impact-gated PR**; drift is **re-verified** on that PR | Full **agent-execution control plane**: org policy gates on what agents may act on |
| **Governance** | None (single user, local) | Roles, shared plans, approval workflow, drift-in-CI | SSO / RBAC, audit logs, org policy gates, data residency |
| **Price** | **$0** (free, local-first, BYO-key) | **~$19/seat/mo** (directional) | **Custom** |

**Design invariants that hold across all three editions:**

- **BYO-key, never metered on tokens.** The developer's own LLM key is used throughout; PlanMap never meters or marks up token usage in any edition. Default provider is Anthropic Claude; Amazon Bedrock (Claude-on-Bedrock) is supported for enterprise data residency. The "no LLM margin" reality is deliberately converted into a **trust selling point** — "we never see your code or your keys" (see §4).
- **The `.planmap` data is the single source of truth, dual-view.** It projects to BOTH a 2D graph (React Flow / `@xyflow/react`) AND auto-generated markdown, so teams get clean git diffs, reviewable PRs, and interop with Spec Kit / OpenSpec — at every tier.
- **Impact Analysis discipline is identical everywhere.** A static code parser decides *what* is affected; the LLM only explains *why* in plain language, and uncertainty is always visible. This is edition-independent because it is the product's core credibility position, not a tier feature. Confidently-wrong impact analysis is worse than no tool.
- **Drift is always measured against an explicitly *approved* Plan Graph node**, and the stored annotation preserves the *why*. Solo drift runs on the dev's own code; Team adds drift-in-CI; Org adds the cross-layer stitch — but the semantic (code ↔ approved intent ↔ recorded rationale) never changes.

**Why the tier boundaries sit exactly here.** The free/paid line is drawn where the market evidence says value becomes *collaborative* and *budget-owning*. The lesson from CodeSee (wound down Feb 2024; assets absorbed by GitKraken mid-2024) is that a beautiful graph for a single user is a "nice to have" that does not convert — strong free-user growth, inconsistent revenue. So Solo must be genuinely, permanently useful (real auto-map + Impact Analysis + Drift on your own repo), while the things a *team* and an *org* will pay for — shared plans, approval workflow, drift-in-CI, cross-repo/cross-layer impact, governance/audit — sit behind Team and Org. This is "land on individual pain, monetize on org-level governance," which is also the path Port and Cortex actually walked.

---

## 2. Learn/Guide mode across editions

**What it is.** Learn/Guide mode is a pedagogical *presentation* of the auto-populated map — same underlying `.planmap` data, a new view plus an entitlement. It lets a newcomer use the live map as a guide to real production: business-first, progressive disclosure, guided tours of the real prod path, surfacing the *why*.

**How it works.** Learn/Guide mode reuses the exact primitives PlanMap already computes:

- **Business-first, progressive disclosure** maps directly onto the existing Zoom + Lens model. A newcomer starts at the **Constellation** (whole system, node = feature) under the **Business Lens** (features linked by user journey), then zooms into a single **Feature Space** (node = step) and switches to the **Backend** or **Security** Lens only when they want implementation detail. Nobody is shown everything at one altitude — breadth up top, depth inside.
- **Guided tours of the real prod path** are generated from the Evolution Graph (what *actually* exists, derived by reading real code/infra) rather than hand-authored. A tour is a walk over real nodes, each of which stores the location of its code.
- **Surfacing the *why*** is the reused annotation layer — the accumulated rationale attached to nodes (e.g., "7-day refresh window — matches the food-delivery session pattern where users order weekly, not daily"). This is precisely the *why* that dies in chat transcripts and that no git log or codebase scan can reconstruct.

**Why it does not rot like CodeSee.** CodeSee's "code tours" were **hand-authored** — a human wrote a walkthrough, the code moved, and the tour silently became a lie. That is the same decay curve that killed hand-maintained catalogs (ServiceNow CMDB's chronic "stale, inconsistent, untrustworthy data"; Backstage catalogs that are "never completed," with 56% of adopters citing upkeep as their top pain). PlanMap's Learn/Guide mode is different in kind because:

1. **It is generated from the live map, not authored.** The tour is a projection of the auto-populated Evolution Graph, so it exists only where real code exists.
2. **It is re-verified by Drift.** Every node in a tour links to code via a stored hash and `last_verified` timestamp; when the underlying code is removed, errors, or diverges from the approved intent, the node is flagged `drifted` or `error` — and the tour visibly flags it too. A guide *cannot* quietly rot, because the same drift engine that protects the map protects the tour. This is freshness-by-construction, the wedge that separates PlanMap from the visualization graveyard.

**Onboarding value for teams and enterprise.** This is where Learn/Guide mode earns its entitlement. New hires, rotating engineers, and platform teams inheriting an unfamiliar service face exactly the comprehension gap DeepWiki addresses — but as a *read-only article you read*, not a live, verified guide to the approved prod path. For Team and Org buyers, Learn/Guide mode turns the same drift-checked map they already pay for into a self-serve onboarding surface: a new engineer can walk the real path of a product, see the business intent before the code, and trust that what they are shown matches reality because drift would have flagged it otherwise. It is the same data, so it costs nothing extra to maintain — and unlike a wiki or a Backstage TechDocs page, it does not need a human to keep it honest.

---

## 3. The one-engine-serves-all mechanism (for a product audience)

The single most important architectural decision behind the edition strategy: **there is no per-edition codebase.** Every feature lands in `core` first, then gets a surface. Editions differ only along three seams.

**(a) Storage adapter — same schema, two backends.** The engine talks to storage through one interface with two implementations:

- **`LocalStore`** — SQLite/JSON inside a `.planmap` store on the developer's machine. No server, no account. This is what Solo runs.
- **`CloudStore`** — Postgres, hosted or self-hosted. This is what Team and Org run.

Both implement the **identical schema**. Because the data model is the single source of truth and is plain, git-committable JSON that projects to both graph and markdown, moving from Solo to Team is a *store migration*, not a re-learning. A solo dev's `.planmap` store is portable into a team's hosted store without reshaping their plans, annotations, or drift history. The same web UI runs whether it points at localhost or a hosted endpoint.

**(b) Connector interface — load only what the edition entitles.** Ingestion is pluggable. Solo loads **only** the git/code connector (TypeScript-JS first, via ts-morph). Team registers more (GitHub-org, Postgres/DB schema, basic AWS, Jenkins). Org registers the full suite (DB, AWS, Jenkins, Bedrock usage). The connectors are *inputs*; the defensible product is the drift-graph + agent-execution brain built on top of them. This reflects the deliberate **buy/borrow ingestion, build the brain** strategy: PlanMap does not try to out-integrate funded ingestion specialists (CloudQuery raised ~$34.5M, Firefly ~$29.5M doing *only* the ingestion layer). It borrows GitHub API, CloudQuery/Steampipe, AWS Config, and Jenkins API as inputs and builds the cross-layer intent-vs-reality diff that none of them owns.

**(c) Entitlements — one gate, many features.** Everything else — cross-repo impact, shared plans, approval workflow, drift-in-CI, roles, the cross-layer drift stitch, SSO/RBAC, audit logs, the agent-execution control plane, org policy gates, Learn/Guide mode — is a capability the entitlement layer switches on. There is no forked feature code; a Team or Org simply unlocks capabilities that already exist in `core`.

**Why this matters commercially.** This is what makes "land bottom-up, expand top-down" *cheap to operate*. A solo dev's free local install and an enterprise's VPC deployment run the same engine, so:

- Every improvement to the core (better static-analysis accuracy, sharper drift, richer annotations) ships to all three editions at once — the free tier is the enterprise engine, which builds trust.
- Expansion is friction-light: a Solo user who joins a Team keeps their store, their plans, and their annotations. A Team that grows into Org governance does not migrate products — it turns on connectors and gates.
- The neutrality promise (agent/IDE-agnostic, local-first option, BYO-key) is structural, not marketing. Because the same engine runs locally with no account, "your code and keys never leave your machine" is literally true at the Solo tier — a position agent vendors are structurally disincentivized to occupy while they are also an agent.

---

## 4. Go-to-market

### 4.1 Land bottom-up, expand top-down

The motion is dictated by two hard constraints from the research. First, **top-down "boil-the-ocean map" sales is where platform initiatives die** — Gartner-adjacent framing reports ~60–70% of platform-engineering initiatives fail to deliver impact and roughly half of platform teams are disbanded or restructured within ~18 months (directional, industry-sourced). Second, **the org-wide living map is a graveyard for the naive version** — CMDB decay, Backstage catalogs "never completed," CodeSee's shutdown. So PlanMap **lands bottom-up** (Solo: free, local-first, developer-loved, zero procurement) on undeniable individual pain, earns trust with an accurate, auto-populated, drift-checked slice, and **expands top-down** into Team collaboration and then Org governance — the same path Port and Cortex walked.

The individual pain is real and quantified, not anecdotal: ~90% of technology professionals use AI tools (DORA 2025), yet ~30% have little or no trust in AI-generated code and >60% have found AI-introduced errors *after* deployment; GitClear's 211M-line study found duplicated code blocks rose ~8× in 2024, copy/paste climbed 8.3%→12.3% (2021→2024), and refactoring collapsed from 25% to <10%. That is the "AI wrote something that broke elsewhere, and nobody remembers why" pain that Solo's Impact Analysis + Drift loop lands on directly.

### 4.2 Buyer progression

| Stage | Buyer / user | What flips them | Edition |
|---|---|---|---|
| 1 | **Solo dev / indie hacker / OSS maintainer** | Feels the "AI broke something elsewhere" pain daily; installs via CLI/VS Code, no account, no procurement; reachable via OSS + content + marketplace | Solo (free) |
| 2 | **Team lead / senior engineer** | Wants a gate to approve architecture before juniors + agents run; needs shared plans, approval workflow, cross-repo impact | Team |
| 3 | **Platform / DevEx / eng-productivity team** | Owns the budget line for reducing instability and rework (tied to DORA metrics); wants drift-in-CI standardized across teams | Team → Org |
| 4 | **Enterprise (platform + security + compliance)** | Needs to *prove code matches approved intent* org-wide, with SSO/RBAC, audit, data residency, and controlled agent execution | Org |

The expansion path in one line: **solo dev installs for Impact Analysis (avoid breaking things) → invites team for plan approval → team adopts drift-in-CI → platform team standardizes it for rework/instability reduction → enterprise buys the org-wide cross-layer drift stitch, governance, and agent-execution control plane.** Land on individual pain, expand on team workflow, monetize on org-level governance. The Org budget is co-signed by whoever owns the brand-new 2026 **AI-agent-governance** line (which Port is explicitly chasing with its $100M-raised "Context Lake" + agent registry) and by the existing platform-engineering budget (an $8B+ market growing ~24%).

### 4.3 Pricing rationale against comparables

**Comparable anchors:**

| Product | Price point | Model |
|---|---|---|
| GitHub Copilot | Free / **$10** Pro / **$19** Business / **$39** Enterprise (+ $100 Max) | Seat + AI-credit hybrid (1 credit = $0.01) |
| AWS Kiro | Free / **$20** Pro / **$40** Pro+ / **$200** Power | **Credit** model (~$0.04/vibe request) |
| Cursor | ~**$20**/seat + usage | Seat + usage |
| Atlassian Compass | Free (3 users) / **$8** Standard / **$25** Premium | Per-user, bundled with Jira/Bitbucket |
| Port | ~**$30**/seat/mo (Standard) | Per-seat IDP |
| Sourcegraph Cody | **$59**/user (enterprise) | Enterprise seat |
| Spec Kit / OpenSpec / DeepWiki | **Free / OSS** | — |

**PlanMap's pricing:**

- **Solo — $0.** Full auto-map, Plan Graph + markdown, Impact Analysis, Drift on your own code, scoped agent handoff, and Learn/Guide mode, single user, local-first, BYO-key. Free is not a trial; it is the permanent developer-loved wedge (Spec Kit's ~90–111k stars and OpenSpec prove OSS-led SDD distribution works). Solo must be genuinely useful so it seeds adoption — but the collaboration/governance value sits above it, avoiding CodeSee's "free that can't convert" death.
- **Team — ~$19/seat/mo (directional).** Deliberately positioned **below Port's ~$30** (we are not selling a full IDP), **at parity with Copilot Business ($19)** and just under **Kiro Pro ($20)**, and **between Compass Standard ($8) and Premium ($25)**. The pitch is not "another portal seat" — it is "the plan-approval + drift-in-CI + cross-repo impact layer that works *with* the agents and IDEs you already pay for." Charging a flat, predictable per-seat price (not usage) is a competitive stance, not just a number.
- **Org — custom.** SSO/RBAC, audit, data residency (Bedrock in their AWS), the cross-layer drift stitch, and the agent-execution control plane are enterprise-value features priced to the account, consistent with how Cortex, Port, and ServiceNow sell top-down.

**The BYO-key, never-metered principle — and why it is a pricing *weapon*, not a constraint.** PlanMap charges for the tool, **never for tokens**, in every edition. This is a direct, deliberate lesson from **Kiro's August 2025 credit-model backlash** — a botched pricing change that *The Register* called a "wallet-wrecking tragedy," triggering public revolt and refunds. Credit/usage metering on LLM calls creates unpredictable bills and a permanent trust wound; Copilot's and Kiro's hybrid credit models carry the same latent risk. Because PlanMap is BYO-LLM-key and hosts no model, it has "no LLM margin" to capture anyway — so it turns that constraint into the core trust message: **"we never meter your usage, we never see your code, we never touch your keys."** Two failure modes are thereby designed out at once: (a) credit-model backlash (avoided entirely — nothing is metered), and (b) free-can't-convert (avoided by putting team/collaboration + drift-in-CI + audit behind paid tiers).

---

## Roadmap extensions & the company-brain horizon (post-M1)

Everything in this section is **north-star horizon and explicitly NOT part of Milestone 1** — M1 stays frozen as the one-repo auto-map → Impact Analysis → Drift loop on the Solo edition, and every item below is sequenced strictly *after* that loop ships and earns trust; none of them enters M1. They are recorded here as product-level roadmap items so the edition strategy reads forward without ever diluting the frozen scope, and each is consistent with the three-edition matrix above (no change to the matrix or pricing).

- **1. Communication connectors (Slack / email) — Team / Org.** New ingestion connectors that read where conversations happen, added under the existing pluggable connector interface. Crucially, comms are ingested as **intent signals only** — hints about what people *meant* to build — and are **never a co-equal source of truth**. They enrich annotations and candidate intent; they never dissolve the code + schema + cloud + CI-grounded moat that makes the map verifiable. Post-M1; not in Milestone 1.

- **2. Proactive planning — Team / Org.** Instead of waiting for a human to open the canvas, PlanMap watches where work is actually decided (Slack / email / issues, via the intent-signal connectors above) and **drafts** Plan Graph nodes and suggested builds for review, extending the existing prompt → plan → approve → execute pipeline with a proactive first step. **Human approval always gates** — nothing is planned or executed without an explicit approve on the drafted node. Post-M1; not in Milestone 1.

- **3. Stakeholder view — all editions (as an entitlement).** An extension of Learn/Guide mode aimed at **non-technical teams** (sales, marketing, PM, execs): plain-language, Business-lens explanations of features, status, and roadmap — "explain the product to a client." It is the *same live map* re-presented for non-engineers, and because it is a projection of the auto-populated graph it is **re-verified by Drift and cannot rot**, exactly like the engineer-facing guide. It rides across all three editions as an entitlement, mirroring how Learn/Guide mode already spans the matrix. Post-M1; not in Milestone 1.

- **4. "Company brain" — Org north-star.** The Org edition's ultimate form: an **always-fresh, multi-source system-of-record** — grounded in code + schema + cloud + CI, with comms as intent signals — that both technical and non-technical people query and that agents act on. It is differentiated from horizontal RAG-over-docs "brains" (Glean, Microsoft 365 Copilot, Dust, Notion, Sana) by being grounded in **verifiable system reality** and by being **executable**, not just retrievable. YC named "Company Brain" an official Summer 2026 RFS (Tom Blomfield); its framing — *structure fragmented knowledge, keep it current, turn it into an executable skills file for AI* — describes PlanMap's DNA directly. This is pursued as a **north-star narrative, not a near-term product**: the comms and non-technical layers are always grounded read-outs on the verified map, **never a co-equal source of truth**. Org north-star; explicitly not in Milestone 1.

---

## 5. Success metrics per edition

The north-star signal across all editions is **annotation reuse** — whether teams keep and *reuse* the accumulated *why* (in drift checks, onboarding, audits). Per the "AI agents stack" thesis, model/harness/UI layers are rented while context/schema/verification layers are *owned*; the `.planmap` annotation store is an owned layer, but its lock-in is only real if annotations accumulate faster than they rot and teams feel loss on leaving. Everything below ladders up to that.

### Solo — is the core loop loved?

- **Activation:** install → first successful auto-map → **first Impact Analysis run** (the "aha"). Track time-to-first-impact.
- **Return usage (the real signal):** does the developer open the Plan Graph again, unprompted, on their 2nd and 3rd feature?
- **Impact accuracy (the most important number):** real dependencies caught vs. missed vs. invented. A few confidently-wrong "this will break" calls destroy adoption — trust is asymmetric.
- **Drift catches:** each real drift caught on the dev's own code proves the thesis in miniature.
- **Manual-edit rate:** how often the human authors/edits nodes. High = the canvas earns its keep; zero = they don't trust it or don't need it.

### Team — does it become a workflow, not a toy?

- **Annotation reuse (north star):** are annotations authored once and *referenced again* in later drift reviews, PRs, and onboarding?
- **Plan approval rate:** are plans actually going through the approval gate before agents run (engagement with the governance surface)?
- **Drift-in-CI adoption:** share of repos with the drift check wired into CI (workflow stickiness — the "GitHub Action gate" pattern).
- **Cross-repo impact usage:** frequency of impact analyses that span more than one repo (proves the Team-tier value over Solo).
- **Behavior change:** measurable reduction in reverts/rework — trackable via git churn, echoing GitClear's methodology.
- **Solo → Team conversion** and **seat expansion within a team.**

### Org — does the cross-layer stitch prove out and stick?

- **Cross-layer drift catches:** drift caught spanning **code + schema + cloud + CI** simultaneously — the specific stitch no incumbent owns (Firefly = infra only; Port/Cortex = service catalog only; Multiplayer = architecture/APIs only; Sourcegraph = code graph only). Each such catch is a proof of the moat.
- **Agent-execution governance:** number of **impact-gated PRs** opened by dispatched agents with drift **re-verified**, and the rate of policy-gate enforcement (agents blocked from acting outside approved scope).
- **Estate coverage & freshness:** share of the estate on the map and the map's staleness (freshness-by-construction is the product — this is the metric predecessors failed).
- **Governance adoption:** SSO/RBAC configured, audit-log usage.
- **Team → Org conversion** and **net revenue retention** (expansion within the account).
- **Learn/Guide mode onboarding:** new-hire time-to-first-productive-navigation, and tours consumed per new engineer.

**Interpreting the signals adversarially.** High install + high free usage but low Solo→Team conversion is the CodeSee failure signature — the graph is loved but not a business; the response is to sharpen the *paid* collaboration/CI/governance value, not to add more visualization. Low annotation reuse at the Team tier means the "behavioral moat" is not forming and the `.planmap` store is portable-but-not-sticky — the most important early warning to watch. Low Impact Analysis accuracy at any tier is existential and overrides everything else: it collapses the entire "we don't hallucinate dependencies" credibility position, so it is measured and defended first.
