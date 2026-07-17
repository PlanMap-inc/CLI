# PlanMap — Adjacent Competitive Landscape: Internal Developer Portals, Config Graphs, Architecture Intelligence & Org-Wide Agent Platforms

**Prepared:** 2026-07-17 · **Scope:** Complementary to the first report (spec-driven development / AI plan modes — Spec Kit, Cursor, Claude Code, Kiro, DeepWiki, Tessl — deliberately NOT re-covered). This report maps the categories PlanMap's "live, executable, drift-tracked map of the entire production estate" expansion would enter.

---

## 0. The one-paragraph orientation

PlanMap's expanded vision — a continuously-synced map of every repo, database, cloud resource, and pipeline, kept in sync with reality and executable by AI agents — sits at the intersection of four maturing categories: (1) **Internal Developer Portals (IDPs)/software catalogs**, which own "system of record for services + ownership," are the closest analog, are well-funded, and are pivoting hard to AI-agent governance in 2025–2026; (2) **cloud asset inventory / CMDB / config-graph** tools, which own "what's actually running in prod" and the drift problem; (3) **architecture-as-code / architecture intelligence**, which owns the visual/model layer and is where the "map kept in sync with code" idea already exists; and (4) the brand-new **org-wide agent platform** land grab, where GitHub, AWS, Atlassian, and Cognition are each building a control plane for agents acting across the estate. The strategic tension for PlanMap: the "living map of everything" is a *real and increasingly funded* category, but it is also a documented graveyard because catalogs are brutally hard to populate and keep fresh.

---

## 1. Internal Developer Portals / software catalogs

This is PlanMap's nearest neighbor: the catalog is literally "a map of your software systems + ownership + dependencies," and every vendor here is now adding an agent layer on top.

**Backstage (Spotify → CNCF)** is the gravitational center. Donated to CNCF in 2020, incubating since 2022, and now undergoing the security audit toward *graduated* status; in CNCF's 2025 velocity ranking it placed 6th of 230+ projects, more than doubling contributions since 2024, with ~1,600 contributors, ~13,000 certified developers, and adoption cited at ~3,400 organizations (Spotify's own internal adoption ~96%) [1]. Backstage is a *framework*, not a product — and that is the crux. Populating its catalog means hand-authoring `catalog-info.yaml` files across every repo, which "poses an adoption challenge even before the portal is launched," and "cat(alog) herding … often leads to stalled roll-outs and catalogs that are never completed" [8]. Roadie's **2025 State of Backstage** report found **56% of adopters cite upgrades as their single biggest pain point** (upgrades often require code changes, not a version bump), and **91% still self-host** despite the maintenance burden [5]. This is the central lesson for PlanMap and is quantified evidence for the "empty/stale catalog death."

**Commercial layer on/around Backstage & alternatives:**
- **Cortex** — managed IDP; raised a **$60M Series C (Sept 2024, Scale Venture Partners) at a ~$470M post-money valuation; ~$198M total raised** [2]. Explicitly investing Series C proceeds in "engineering intelligence … and AI." By 2025–2026 it ships an **MCP server** exposing catalog/Scorecards/metrics to agents, an **AI Readiness Scorecard** (Bronze/Silver/Gold), and **"Magellan," an AI engine for automated catalog import and discovery audit** [25] — i.e., using AI to solve its own catalog-population problem.
- **Port** — the loudest 2025–2026 signal. Raised a **$100M Series C at an $800M valuation (Dec 2025, General Atlantic; Accel, Bessemer, Team8), ~$158M total** [3], explicitly to "turn its developer portal into an agentic AI hub" and positioned by press as the managed alternative to "build-it-yourself Backstage." Pricing is public and low-friction: **~$30/seat/month** (annual) Standard tier [3]. Port now markets a **"Context Lake" + agent registry** to *catalog, govern and measure AI agents* (code-first SDK agents, cloud-managed agents like Bedrock/Azure AI Foundry, and Port-native), with an MCP server exposing the catalog as callable, governed tools [26]. This is the closest competitor to PlanMap's "agents execute against the map" thesis — and it is now extremely well-capitalized.
- **OpsLevel** — IDP with AI "throughout"; ships **Tidra AI** ("automate code maintenance at scale") and an **MCP server** exposing service metadata to LLMs; a **Catalog Engine** specifically to auto-build/maintain the catalog. Funding is comparatively modest (~$12M total, last a Series A) with custom/contact pricing [4].
- **Atlassian Compass** — the enterprise distribution threat. **Free for 3 users; Standard $8/user/mo; Premium $25/user/mo**, tightly bundled with Jira/Bitbucket/Opsgenie [6]. Atlassian's real weapon is the **Teamwork Graph** (see §4).
- **Roadie** — managed Backstage (~$3.7M raised, Dublin); customers include Netlify, Snyk, Contentful; launched **Roadie Local** (free < 15 users) in 2025 and publishes the State of Backstage report [5]. Positions itself increasingly as "engineering context for AI agents."
- **Configure8** — smaller IDP (~$7.23M raised, founded 2021, McLean VA); still listed as active but with limited fresh 2025–2026 traction data [7] — a reminder the mid-tier is thin.

**Why catalog population is "the hard part"** (repeated verbatim across vendor material): manual YAML doesn't scale to "thousands of services … and hundreds of thousands of cloud resources constantly changing," and "a stale catalog erodes trust fast, and once developers stop believing the portal, adoption collapses" [8]. Every serious 2025 player now answers this with **automated discovery / AI import** — this is the current competitive battlefront, and it is exactly PlanMap's proposed mechanism.

---

## 2. Cloud asset inventory / CMDB / config-graph

This category owns the "what is *actually* running in prod, and does it match intent" question — the reality half of PlanMap's "intent vs. reality" drift promise.

- **AWS Config** is the native baseline: it records resource configuration, relationships, and **config drift vs. desired state** via conformance packs — but is single-cloud, AWS-only, and infra-level (not repo/feature-level). It's a data source PlanMap would consume, not a competitor.
- **ServiceNow CMDB** is the incumbent "single source of truth" for enterprise IT — and the definitive cautionary tale. Industry and ServiceNow's own community material concede that "almost every organization struggles to build and maintain a CMDB that is both accurate and useful," with the dream "often giving way to a reality of stale, inconsistent, and untrustworthy data" (duplicate CIs, stale records, broken relationships) [10]. ServiceNow's 2025–2026 answer is **Now Assist for CMDB** — AI-assisted detection of stale/inconsistent records [10]. The parallel to a "living org map" is exact: *the CMDB is the 20-year proof that a hand-maintained enterprise map decays, and that AI is now being retrofitted to keep it fresh.*
- **Firefly** — cloud asset management explicitly built around **drift**: it classifies every cloud resource as *codified, unmanaged, drifted, or ghost*, continuously compares desired vs. actual config, and auto-generates Terraform/Pulumi from existing infra [9]. Funding: **$23M Series A (May 2024, Vertex; SoftBank, Hanaco, JLR's InMotion), ~$29.5M total** [9]. This is the closest existing product to PlanMap's "flag drift org-wide" claim — but scoped to infra/IaC, not code+features.
- **Steampipe / Turbot Pipes** — query cloud/APIs live with SQL (150+ plugins, 2,000+ tables; v1.0 Oct 2024); Turbot Pipes managed tiers from a free Developer plan to Team (~$10/user/mo). Shipped **MCP servers for agent integration** across 2025 [11].
- **CloudQuery** — open-source (MPL-2.0) cloud asset inventory that ELTs assets into your own Postgres (150+ providers); **raised a $16M Series A (June 2025, Partech), ~$34.5M total** [12]. Steampipe (live query) vs. CloudQuery (ELT into a DB) is the architectural fork PlanMap must also choose between.

**Relevance to PlanMap:** these tools already solve "map everything prod uses" at the *cloud-resource* layer with automated sync and drift. PlanMap's differentiation cannot be "we inventory AWS" (solved, commoditized, MCP-enabled) — it must be the *code+feature+intent* layer stitched to this infra reality.

---

## 3. Architecture-as-code / architecture intelligence

This is where "a model of the system kept in sync with code" already exists as a product idea — with mixed commercial outcomes.

- **Structurizr** (Simon Brown, creator of the **C4 model**) is the original "diagrams-as-code" reference tool: define the model once in a DSL, generate many views, version-control it. C4 got a fresh boost from Brown's 2025 O'Reilly book, and Structurizr "vNext" plus AI plugins (AI suggests missing components, spots violations, generates diagrams from DSL) are the 2025 direction [14]. But it is fundamentally *human-authored intent*, not auto-synced reality.
- **IcePanel** — collaborative C4 modeling; notably lets you "represent your architecture model as code and keep it in sync with IcePanel via API/SDK," and pushes model changes across all diagrams [13]. Freemium; funding not publicly disclosed. Again, human-curated.
- **ArchUnit-style fitness functions** — code-level tests that assert architectural rules (dependency direction, layering) in CI. This is the "executable, drift-catching" pattern PlanMap gestures at, but scoped to one codebase's internal rules, not an org-wide graph.
- **AI-native / auto-sync entrants — the important 2025–2026 shift:**
  - **Multiplayer.app** — the most direct architecture-intelligence competitor: it **"automatically discovers, tracks, and detects drift in your system architecture, dependencies and APIs by directly connecting to your infrastructure,"** with auto-generated service maps and system auto-documentation (GA reached in 2025) [23]. This is essentially PlanMap's "living, drift-tracked map" for distributed systems — already shipping.
  - **CodeSee** — the cautionary graveyard marker: built interactive codebase maps, code tours, and change-propagation visualization; **announced shutdown Feb 2024 and was acquired (undisclosed) by GitKraken May 2024** [22]. A well-funded "visualize your whole codebase" play that could not sustain as a standalone — direct evidence that the *visualization-first* version of this category is fragile.
  - **Sourcegraph** — org-wide code graph/search at scale, now repositioned as "the organization-wide context AI coding tools lack," standardized at Uber, Stripe, Dropbox, and several major banks [17]. Plus a wave of OSS **code-knowledge-graph-for-agents** projects (CodeGraph, GitNexus, "Understand Anything") exploding in GitHub stars through 2026, mostly local-first + MCP [17].

**Takeaway:** "architecture graph kept in sync with code" is validated as a need (Multiplayer, Sourcegraph, the code-graph OSS wave) but has a body count (CodeSee). Pure visualization doesn't retain; *executable/agent-consumable* graph is the live frontier.

---

## 4. "AI agents acting across the whole estate / codebase graph" (2025–2026)

This is the fastest-moving and most strategically dangerous category for PlanMap, because the platform giants are converging on exactly PlanMap's "agents plan/execute against an org-wide graph" concept.

- **GitHub — Agent HQ** (GitHub Universe, Oct 2025): a "mission control" command center to orchestrate multiple vendors' agents (Copilot + Anthropic, OpenAI, Google, Cognition, xAI) across GitHub, VS Code, mobile, CLI; an enterprise **control plane** for agent permissions/policy/audit; and **`AGENTS.md`** config-as-code so agent behavior is versioned in the repo [21]. GitHub owns the repos — the substrate of PlanMap's map — and is building the agent orchestration layer on top of it.
- **AWS — Amazon Bedrock AgentCore** (GA **Oct 13, 2025**): production infrastructure for enterprise agents — **Runtime, Memory, Gateway** (zero-code MCP tool creation from APIs/Lambda), Identity, Observability; VPC/PrivateLink/CloudFormation support [15]. This is the managed substrate on which an "agents execute against your estate" product (including PlanMap-like systems) could be built — or against which AWS competes directly.
- **Atlassian — Teamwork Graph + Rovo**: a "living, evolving map of how work gets done across teams, tools, goals, and decisions" with **150B+ connections**, now (Team '26, 2026) **opened to any MCP-compatible third-party agent** via a Teamwork Graph CLI and Rovo MCP server; **Rovo Studio** (no-code agent builder) is GA; **>90% of Atlassian enterprise cloud customers use Rovo** with a reported 7× increase in agent-led automations [18]. Atlassian is explicitly building the "living org map that agents reason over" — conceptually the closest strategic analog to PlanMap's north star, from a company with enormous enterprise distribution.
- **Cognition (Devin)** — the capital and momentum benchmark for autonomous coding agents: **acquired Windsurf (~$250M, July 2025)**; **$400M round at a $10.2B valuation (Sept 2025)**; Devin ARR grew **$1M (Sept 2024) → $73M (June 2025)**; reportedly in talks at a **~$25B valuation (April 2026)** [16]. Windsurf's IDE telemetry now feeds Devin to lower multi-file error rates — i.e., grounding agents in real codebase context, the same "context is the moat" thesis PlanMap depends on.

**Implication:** the "org-wide graph + agents execute against it" idea is being pursued simultaneously by GitHub (code substrate), AWS (agent infra substrate), Atlassian (work-graph substrate), and the well-funded IDPs (Port's Context Lake, Cortex's MCP). PlanMap is *not* early to the concept; it is entering a contested, capitalized race. The whitespace is the *specific stitch* none of them fully owns: intent-vs-reality drift across **code + schema + cloud + CI simultaneously**, executable by agents.

---

## 5. Market sizing

Note: this is the **IDP/platform-engineering/DevEx** market, which is *distinct from the AI code-generation market* (Copilot/Cursor/Devin) — PlanMap's expansion straddles both, but the buyable "portal/catalog/platform" budget is the relevant TAM here.

- **Internal Developer Portal (narrow):** ~**$1.8B (2025) → ~$4.95B (2030), ~22.4% CAGR** per one forecast; another puts it **$2.85B (2025) → $8.92B (2033), ~15.2% CAGR** [19]. Treat exact figures as directional — third-party market-research reports, methodologies vary, so [range, not precision].
- **Platform Engineering & IDP (broad):** ~**$8.24B (2025) → ~$23.9B (2030), ~23.7% CAGR** (Virtue/Mordor-class reports) [19].
- **Adoption tailwind (the strongest datapoint):** Gartner's forecast that **80% of large software-engineering organizations will have platform teams by 2026** (up from 45% in 2022) is now reported as having materialized [20].
- **Critical counter-signal:** secondary analyses of the same trend report that **~60–70% of platform-engineering initiatives fail to deliver impact, and nearly half of platform teams are disbanded or restructured within ~18 months** [20]. (These specific failure percentages come from industry blogs citing Gartner-adjacent framing — treat as [directional/unverified] rather than a hard Gartner primary.)
- **Adjacent — Software Engineering Intelligence Platforms** (DX, Jellyfish) are a fast-growing, Gartner-tracked neighbor now "transitioning to Developer Productivity Insight Platforms" [24]; relevant because Cortex/Port are absorbing "eng intelligence" into the portal, blurring category lines.

**Read:** the category is real, large, and growing ~20%+ — but the failure/churn rate confirms that *buying* a platform and *getting value* from it are very different, and that maps/catalogs specifically are where projects stall.

---

## 6. Strategic read for PlanMap

**(a) Is "org-wide living executable map" a real buyable category — or a graveyard?**
Both. It is demonstrably *buyable*: Port just raised $100M/$800M explicitly on the agentic-portal thesis [3]; Cortex raised $60M [2]; Atlassian is opening a 150B-edge work graph to agents [18]; Firefly and Multiplayer sell drift-tracked maps today [9][23]; the platform-engineering market is $8B+ and growing ~24% [19]. But it is also a *graveyard for the naive version*: ServiceNow's CMDB is the 20-year monument to hand-maintained maps decaying into "stale, untrustworthy data" [10]; Backstage adopters name catalog population and upkeep as the top blockers (56% cite upgrades; catalogs "never completed") [5][8]; ~half of platform teams get disbanded within ~18 months [20]; and CodeSee — a funded "map your whole codebase" startup — shut down and was absorbed [22]. **Verdict: real category, but the moat is freshness/accuracy, and that is exactly where predecessors died.**

**(b) The wedge that avoids the "empty catalog" death.**
Every incumbent's own 2025–2026 pivot points at the answer: **the map must auto-populate and auto-refresh from ground truth, never from humans filling in YAML.** Cortex added "Magellan" AI catalog import [25]; OpsLevel built a Catalog Engine [4]; Firefly/Multiplayer are 100% auto-discovery [9][23]. PlanMap's wedge should therefore be a **narrow, high-signal, zero-manual-entry slice that is derivable directly from GitHub + cloud + CI** and that *proves value in one flow* before breadth — e.g., "point at your GitHub org + AWS account + Jenkins, and within an hour see an accurate intent-vs-reality drift map for one product's prod path, with an agent that can act on it." The differentiator vs. Firefly (infra-only) and Port/Cortex (service-catalog-only) is **binding code + schema + cloud + CI into one drift-checked graph that an agent executes against** — the cross-layer stitch nobody fully owns. Freshness-by-construction is the product, not a feature.

**(c) Buyer, budget line, sales motion.**
- **Buyer / budget:** the platform-engineering / DevEx / DevProd team lead, VP Eng, or Head of Platform — spending from an **existing IDP/platform-engineering budget line** (the $8B+ market), increasingly co-signed by whoever owns **AI-agent governance** (a brand-new 2026 budget Port is explicitly chasing) [3]. Secondary: cloud/FinOps/security owners (the Firefly/CMDB budget).
- **Motion:** the honest read is **bottom-up land, top-down expand.** Backstage/Steampipe/OSS code-graph adoption is bottom-up; but org-wide *rollout* and *keeping it fresh* are top-down governance sales (Port, Cortex, ServiceNow all sell top-down at the enterprise). A tiny team should **land bottom-up** (free/self-serve, one-repo/one-product value, developer-loved) precisely because top-down "boil-the-ocean map" sales is where 18-month platform failures happen.

**(d) Build cost/time reality for a tiny team.**
Sobering. An org-wide map requires connectors to GitHub org, multiple clouds (AWS Config/APIs), Jenkins, databases/schemas, Bedrock usage — each a maintenance treadmill (recall Backstage's 56%-cite-upgrades pain [5] and CloudQuery/Steampipe existing *purely* to maintain 150+ provider integrations [11][12]). Building broad, accurate, always-fresh ingestion is a multi-year, multi-team effort — it is why CloudQuery ($34.5M) and Firefly ($29.5M) are *funded companies doing only the ingestion layer* [9][12]. A tiny team cannot out-integrate them. The realistic build is **narrow-first**: lean on existing sources (GitHub API + AWS Config/CloudQuery/Steampipe MCP + Jenkins API) as *inputs*, and build the thin, defensible layer on top — the intent-vs-reality diff + agent execution against it. Buy/borrow ingestion; build the drift-graph + agent-execution brain.

**(e) The single strongest argument each way.**

- **FOR starting org-wide:** *The value and the defensibility are both emergent at the org level — a single-repo map is a commodity, but the cross-repo/cross-service/cross-cloud drift graph is the moat, and it is exactly what the best-funded players (Port's $100M Context Lake, Atlassian's 150B-edge Teamwork Graph opened to agents, GitHub Agent HQ) are racing to own right now [3][18][21].* If PlanMap waits, one of them closes the gap and the org-wide category is theirs; the "intent vs. reality across the whole estate" narrative is only compelling at estate scale.

- **AGAINST (start single-repo and grow):** *Every piece of evidence says the org-wide map dies of staleness/emptiness before it delivers value — ServiceNow CMDB's chronic "untrustworthy data" [10], Backstage catalogs "never completed" [5][8], ~half of platform teams disbanded in 18 months [20], and CodeSee's outright shutdown [22]. A tiny team cannot build fresh org-wide ingestion faster than $30M-funded specialists, so betting on breadth first is betting into the exact failure mode that has killed predecessors.* Land a single-repo/single-product wedge that is undeniably accurate and agent-executable, earn trust, then expand outward — the same path Port and Cortex actually walked.

**Bottom line:** the category is real and hot, the giants are converging, and the graveyard is real too. PlanMap's only viable path is an *auto-populated, freshness-by-construction, cross-layer (code+schema+cloud+CI) drift graph that agents execute against*, landed narrow and expanded org-wide — never a human-maintained catalog sold top-down.

---

## Sources

1. CNCF — Backstage project status & 2025 velocity; The New Stack, "Five Years In, Backstage Is Just Getting Started." https://www.cncf.io/blog/2026/02/09/what-cncf-project-velocity-in-2025-reveals-about-cloud-natives-future/ ; https://thenewstack.io/five-years-in-backstage-is-just-getting-started/
2. Cortex — "Our Series C — $60M in New Funding"; FinSMEs. https://www.cortex.io/post/announcing-series-c ; https://www.finsmes.com/2024/09/cortex-raises-60m-in-series-c-funding.html
3. Port — TechCrunch "$100M at $800M valuation"; SiliconANGLE; Port pricing & blog. https://techcrunch.com/2025/12/11/port-raises-100m-at-800m-valuation-to-take-on-spotifys-backstage/ ; https://siliconangle.com/2025/12/11/port-nets-100m-turn-developer-portal-agentic-ai-hub/ ; https://www.port.io/pricing
4. OpsLevel — AI page, pricing, Crunchbase. https://www.opslevel.com/ai ; https://www.opslevel.com/pricing ; https://www.crunchbase.com/organization/opslevel
5. Roadie — "2025 State of Backstage Report"; "Backstage: how much does it really cost?"; Roadie Local. https://roadie.io/blog/the-2025-state-of-backstage-report/ ; https://roadie.io/blog/backstage-how-much-does-it-really-cost/ ; https://roadie.io/blog/roadie-local-self-hosted-backstage-ready-in-minutes/
6. Atlassian Compass — pricing. https://www.atlassian.com/software/compass/pricing ; https://community.atlassian.com/forums/Compass-articles/Announcing-Compass-pricing-Free-software-catalog-for-all/ba-p/2334632
7. Configure8 — company profile (Taloflow, CB Insights). https://www.taloflow.ai/guides/products/configure8 ; https://www.cbinsights.com/company/configure8
8. Software-catalog population problem — Port software-catalog guide; OpsLevel Catalog Engine; Roadie catalog completeness. https://www.port.io/guide/software-catalog ; https://www.opslevel.com/resources/the-catalog-engine ; https://roadie.io/blog/3-strategies-for-a-complete-software-catalog/
9. Firefly — product/drift classification; FinSMEs "$23M Series A." https://www.firefly.ai/product ; https://www.finsmes.com/2024/05/firefly-raises-23m-in-series-a-funding.html
10. ServiceNow CMDB accuracy — ServiceNow Community; RapDev "Dirty CMDB"; Now Assist for CMDB (ServiceNow Store). https://www.servicenow.com/community/itom-forum/concerns-about-data-accuracy-and-completeness-improve-the/m-p/3025483 ; https://www.rapdev.io/blog/dirty-cmdb-clean-it-up ; https://store.servicenow.com/store/app/b9fe6f2e1b646a50a85b16db234bcba7
11. Steampipe / Turbot Pipes — project & managed service. https://steampipe.io/ ; https://github.com/turbot/steampipe ; https://turbot.com/pipes
12. CloudQuery — GitHub; Crunchbase/Tracxn ("$16M Series A, Partech; ~$34.5M total"). https://github.com/cloudquery/cloudquery ; https://tracxn.com/d/companies/cloudquery/__n_quLfKYSxVYqJAGddpx6L81mF3TqW8PMWllVtc34RQ
13. IcePanel — C4 modeling, model-as-code sync. https://icepanel.io/c4-model ; https://icepanel.io/pricing
14. Structurizr / C4 model — Simon Brown; Structurizr. https://structurizr.com/ ; https://simonbrown.je/
15. Amazon Bedrock AgentCore — AWS product; GA (Oct 13 2025) analysis; Gateway blog. https://aws.amazon.com/bedrock/agentcore/ ; https://www.ernestchiang.com/en/posts/2025/amazon-bedrock-agentcore-generally-available/ ; https://aws.amazon.com/blogs/machine-learning/introducing-amazon-bedrock-agentcore-gateway-transforming-enterprise-ai-agent-tool-development/
16. Cognition / Devin — CNBC "$10.2B valuation"; TechCrunch Windsurf acquisition; VentureBeat "$400M raise." https://www.cnbc.com/2025/09/08/cognition-valued-at-10point2-billion-two-months-after-windsurf-.html ; https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/ ; https://venturebeat.com/programming-development/cognition-follows-windsurf-acquisition-with-usd400m-fundraise-showing-strong
17. Sourcegraph — "Why code search at scale is essential"; code-graph OSS wave (CodeGraph, GitNexus). https://sourcegraph.com/blog/why-code-search-at-scale-is-essential-when-you-grow-beyond-one-repository ; https://github.com/colbymchenry/codegraph
18. Atlassian Rovo / Teamwork Graph — Atlassian blog; SiliconANGLE (Team '26). https://www.atlassian.com/blog/company-news/rovo-team-26 ; https://siliconangle.com/2026/05/06/atlassian-opens-teamwork-graph-pushes-rovo-agentic-execution-team-26/
19. Market sizing — Mordor Intelligence; Virtue Market Research; MarketIntelo. https://www.mordorintelligence.com/industry-reports/platform-engineering-and-internal-developer-platform-idp-market ; https://virtuemarketresearch.com/report/platform-engineering-internal-developer-platform-idp-market ; https://marketintelo.com/report/internal-developer-portal-market
20. Gartner platform-engineering adoption (80% by 2026) & failure-rate commentary. https://www.gartner.com/en/infrastructure-and-it-operations-leaders/topics/platform-engineering ; https://www.signisys.com/blog/gartner-says-80-of-software-orgs-will-have-platform-teams-by-2026/ ; https://byteiota.com/platform-engineering-80-adoption-70-fail-within-18-months/
21. GitHub Agent HQ — GitHub Blog; VentureBeat. https://github.blog/news-insights/company-news/welcome-home-agents/ ; https://venturebeat.com/ai/githubs-agent-hq-aims-to-solve-enterprises-biggest-ai-coding-problem-too
22. CodeSee / GitKraken acquisition — FinSMEs; GitKraken blog. https://www.finsmes.com/2024/05/gitkraken-acquires-codesee.html ; https://www.gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee
23. Multiplayer.app — auto-discovery & architecture drift; GA launch. https://www.multiplayer.app/system-dashboard/ ; https://www.multiplayer.app/blog/multiplayer-launches-ga-with-new-system-architecture-observability-features/
24. Gartner Peer Insights — Software Engineering Intelligence Platforms (DX, Jellyfish). https://www.gartner.com/reviews/market/software-engineering-intelligence-platforms
25. Cortex AI — MCP, AI Readiness Scorecards, "Magellan" catalog auto-import. https://docs.cortex.io/get-started/cortex-ai-assistant/mcp ; https://docs.cortex.io/solutions/ai-readiness/configure ; https://www.cortex.io/products/scorecard
26. Port AI agents — agent management/Context Lake/MCP. https://docs.port.io/agent-management/overview/ ; https://www.port.io/platform/ai-agents
