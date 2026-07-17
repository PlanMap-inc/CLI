# PlanMap Report #3 — The "Company Brain" Adjacency: Enterprise Work-AI, Comms-Driven Planning, and Explaining Systems to Non-Engineers

*Prepared: 2026-07-17. Complementary to Report #1 (spec-driven dev / agent plan modes) and Report #2 (internal developer portals / config-graph / org agent platforms). This report covers the enterprise-knowledge / "company brain" space and PlanMap's proposed expansion into communication-source ingestion, proactive planning, and non-technical users.*

---

## 0. Why this matters now

PlanMap's proposed expansion collides head-on with the single hottest enterprise-AI category of 2026. In April 2026 Y Combinator made "Company Brain" an official Request for Startups — and the exact language YC used ("a system that pulls knowledge out of all these fragmented sources, structures it, keeps it current, and turns it into an executable skills file for AI") is nearly a verbatim description of what PlanMap already does for *code+schema+cloud+CI*, extended to *all* company knowledge [5][6]. That is both the opportunity and the trap. The opportunity: PlanMap is early to a thesis a top accelerator just anointed. The trap: the general "company brain" is a well-funded, incumbent-dense knife fight, and the RFS is a signal that dozens of new entrants are being minted this year.

---

## 1. Enterprise knowledge / "work AI" / company-brain incumbents

**Glean** is the category king and the benchmark PlanMap would be measured against. It raised a $150M Series F in June 2025 at a **$7.2B valuation** (Wellington-led) [1][2], and crossed **$300M ARR in May 2026**, up from ~$208M at end-2025 and roughly 3x its $100M ARR of 15 months prior [3][4]. Glean does horizontal enterprise search + an agent platform ("Glean Agents") across Slack, Google Workspace, Microsoft 365, Salesforce, Jira, etc., built on a permission-aware "knowledge/context graph" [3]. Notably, Glean's 2026 go-to-market pitch has shifted to **AI cost reduction**: it argues that grounding an LLM in its context graph makes agents consume far fewer tokens than turning them loose on raw systems [3]. **Moat:** hundreds of maintained, permission-respecting connectors; a governed knowledge graph; enterprise trust/security posture; and now distribution/logo density. **Gap relevant to PlanMap:** Glean indexes *documents and messages* — it retrieves and summarizes human-written artifacts. It does not build a verified model of the *running system* (schema, infra, CI), and it does not act on code or check its answers against system reality. Its "truth" is whatever people wrote down.

**Microsoft 365 Copilot** is the gravity well. It crossed **20M paid seats in April 2026** (up from 15M a quarter earlier), sells at **$30/user/month** on annual commitment, is used by >90% of the Fortune 500, and sits inside a Microsoft AI business at a ~$37B annualized run rate (Copilot-related revenue >$14B annualized) [12][13]. For any horizontal "answer questions about your company" play, Copilot is the default that IT already owns.

**Dust** ($40M Series B, May 2026, Sequoia/Abstract; ~$60M total) is the most architecturally similar challenger: a horizontal platform to "deploy, orchestrate and govern fleets of AI agents" connected to 100+ sources including Slack, Salesforce and Drive, positioned around "multiplayer AI" (humans + agents in shared workspaces). It reports ~41,000 MAU across 3,000+ orgs, 300k+ agents deployed, and claimed zero churn in 2025 [7][8]. **Sana** validated the category via M&A: **Workday acquired it for ~$1.1B** (signed Sept 2025, closed Nov 2025) to fold AI search + agents + learning into Workday's "front door for work" [9][10][11]. **Notion AI / Enterprise Search** bundles cross-app Q&A (Slack, Drive, Jira, GitHub, Teams, SharePoint) with a choice of GPT/Claude/Gemini models, riding Notion's existing workspace footprint [14]. **Guru** has repositioned from wiki to an "AI Agent Center" around *verified truth* — answers only from human-expert-approved content, with a March 2026 Slack MCP integration and usage-based AI-credit pricing [15].

**The through-line — and the shared blind spot:** every incumbent ingests communications and documents and does RAG-over-text with permission trimming. None of them treats the *system itself* (live schema, cloud config, CI graph, dependency reality) as a first-class, verifiable, executable source of truth. They answer "what did someone write about X"; PlanMap answers "what is X, actually, right now, in the system." That distinction is the entire strategic wedge (§6).

---

## 2. The YC "Company Brain" thesis

In its **Summer 2026 RFS**, YC partner **Tom Blomfield** named "Company Brain" a priority idea [5]. The stated problem: AI agents cannot reliably do company work because knowledge is "scattered across Slack, email, Notion, GitHub, Linear, Salesforce, support tickets, meeting transcripts, and people's heads." The ask: a system that "pulls knowledge out of all these fragmented sources, structures it, keeps it current, and turns it into an executable skills file for AI" — a living operational map of how a company actually works (how refunds are handled, how pricing exceptions are decided, how incidents are run) so agents act safely and consistently [5][6].

**YC-backed and adjacent startups already chasing it** [6]:
- **Hyper** (YC Spring 2026): ingests Slack, Docs, Email, Calendar, GitHub; retrieval with query expansion + reranking. Reported early traction (~$1K MRR in 12 days, 50+ teams) — *[unverified: single-blog claim]*.
- **GBrain** (open-source, associated with Garry Tan): ~23.6k GitHub stars in two months; deliberately cheap (regex/string-matching, near-zero LLM calls on write, <$100/mo for a 25-person team) *[unverified: single-blog claim]*.
- **Savant, Cerenovus, Memory Store**: named as also racing the space [6].

The sharpest external analysis argues these players "solve 40% of the problem" (retrieval) and miss the hard 60%: **determinism and governance** — hallucinated/inconsistent metric definitions, token cost of querying raw schemas, and lack of auditability/traceable join paths. The recommended missing layer is a *deterministic, versioned semantic layer* under the retrieval layer [6]. A frequently-cited willingness-to-pay figure of **$50–100/employee/month** for a brain that answers *and executes* workflows also circulates, but *[unverified: originates from commentary, not a YC figure]* [6]. **Strategic read of the RFS:** YC's framing ("executable skills file," "living operational map," "act safely and consistently") is closer to PlanMap's DNA than to Glean's — it explicitly emphasizes *execution* and *consistency/governance* over *search*. That is validating. It also means the space will flood with well-pedigreed teams within 6–12 months.

---

## 3. Comms-driven / proactive planning (Slack/email/meetings → tickets/plans/specs)

This is the most mature adjacent capability — and largely a *feature*, not a company. **Linear** shipped **Linear Agent** (March 2026): you @-mention Linear in Slack or Teams and it creates context-aware issues from the conversation; "Linear Intake" and "Linear Asks" triage Slack into routed issues, with AI summaries, duplicate detection and auto-classification; Linear's CEO went as far as declaring "issue tracking dead" in favor of agentic operations [16][17]. **Height 2.0** rebuilt around autonomous PM — agents do backlog grooming, status updates and sprint planning without human prompting [18]. Meeting-to-action tools (and OpenAI/Slack workspace agents) increasingly turn transcripts into drafted issues [16][18]. From Report #1/#2 context, Cursor/Devin already spin work from issues, and coding agents accept tickets as input.

**What exists:** conversation/meeting → *ticket* or *summary*. **What's missing (PlanMap's opening):** none of these scope a proposed build *against a verified model of the existing system*. Linear turns a Slack thread into "add SSO" as a ticket; it does not answer "we already have a half-built SAML flow in `auth-svc`, here are the 3 files, the schema columns, and the CI job it touches, and here's the drift-checked plan." Turning intent into a plan is common; grounding that plan in executable system reality is not.

---

## 4. Explaining code / systems to non-engineers

Four reference points. **DeepWiki** (Cognition/Devin) auto-generates conversational, wiki-style docs for any GitHub repo (50k+ public repos indexed) — but it targets *developers* onboarding to code, and its "non-technical" reach is really "less-familiar engineers" [21]. **Swimm** links AI-generated explanations and auto-updating diagrams directly to code, emphasizing deterministic-plus-AI traceability; again, primarily developer onboarding/comprehension [19]. **CodeYam** (visualizing/previewing code behavior) has thin public presence *[unverified]*. The most instructive is **Driver.ai** (a YC company): a "compiler for codebase context" that pre-computes symbol-complete, deterministic understanding and serves it via MCP, deployed across 25+ enterprises (incl. Fortune 500) over 200M+ LOC [20]. Crucially, Driver explicitly names the buyer pain PlanMap is eyeing: *"Support, product, and QA teams interrupt engineers constantly because they can't access codebase knowledge themselves"* [20].

**Is there real demand and budget from non-technical teams?** The pain is real and widely attested (PMs/sales/support constantly interrupting engineers). But note *who is buying* in every example above: the purchaser and champion is still **engineering/platform**, buying a tool that *relieves* non-technical interruptions — not sales/marketing buying their own seats. Non-technical users are *beneficiaries and read-only consumers*, not (yet) the economic buyer. That is a critical nuance for PlanMap's positioning (§6c).

---

## 5. Market sizing

Two overlapping markets, both sourced with wide vendor variance (flagged):
- **Enterprise search:** ~**$5.3–7.5B in 2025–2026**, growing ~**9–10% CAGR** to ~$11–14.5B by 2030–2035 (Precedence: $5.34B 2025 → $12.71B 2035 @9.05%; Mordor: ~$6.8B 2025 → $11.15B 2030 @10.3%; another: $7.47B 2026 → $11.66B 2031 @9.31%) [22][23].
- **Knowledge-management software:** ~**$16–23B in 2025–2026**, growing ~**13–18% CAGR** (Fortune Business Insights/Grandview cluster: ~$23.2B 2025 → $74B 2034 @13.8%; another: $16.22B 2026 → $37.64B 2031 @18.3%) [24]. *(Broader "knowledge management" figures in the hundreds of billions exist but mix in services and are not a usable SAM.)*

**Interpretation:** the traditional enterprise-search TAM is real but not huge (~$6B); the *interesting* number is the emergent "work AI assistant" spend implied by Copilot's >$14B annualized Copilot revenue and Glean's $300M ARR — i.e., the category is being *created and expanded* by AI, not captured from legacy search budgets [3][12]. PlanMap should size against "AI agent enablement / grounding infrastructure" spend, not the legacy enterprise-search line item.

---

## 6. Strategic read for PlanMap

**(a) Defensible expansion, or Glean/Microsoft bloodbath?**
As a *horizontal* "answer any question about the company from Slack/email/docs" play — **bloodbath, avoid.** Glean ($300M ARR, $7.2B), Microsoft (20M seats, $30/user, owns IT), Notion, Dust, and a Workday-owned Sana already occupy that ground with better connectors, distribution and trust [1][3][9][12]. PlanMap cannot out-connector Glean or out-distribute Microsoft. But the *specific slice* YC actually asked for — an "executable, always-current, governed map that agents act on, consistent and auditable" [5][6] — is **not** what those incumbents do well; their weakness is exactly determinism, verification and executability. PlanMap's defensibility is not "another RAG-over-docs brain," it's "the part of the brain that is *provably true because it's derived from and checked against the running system.*"

**(b) The single sharpest differentiator.**
**Grounded-in-verifiable-system-reality + executable, vs. RAG-over-docs.** Every incumbent's ground truth is human-authored text that may be stale, contradictory or wrong; Glean/Notion/Guru can only be as correct as the docs people wrote. PlanMap's map is *derived from code, schema, cloud and CI and drift-checked against them* — so it is right by construction and detects when reality diverges from belief. This is the exact failure mode the YC-space analysis flagged as the unsolved 60% (metric consistency, governance, auditable/traceable answers) [6]. One-liner: **"Glean tells you what your colleagues said about the system; PlanMap tells you what the system actually is — and can act on it."**

**(c) Non-technical buyer: real buyer or distraction?**
**A powerful expansion of *value* and *usage*, but a distraction as a *wedge/buyer.*** Evidence across Driver.ai, Swimm and DeepWiki shows the pain (non-technical teams interrupting engineers) is real, but the *buyer and champion remains engineering/platform* [19][20][21]. Non-technical stakeholders are beneficiaries who justify the platform's value and expand seats *after* land — they rarely hold budget for a "understand our system" tool and won't run a POC. Treat "explain features to sales/PM/execs" as a **land-expand multiplier and a demo-magnet**, not the initial go-to-market motion.

**(d) Biggest risk of adding Slack/email + non-technical scope too early.**
**Losing the one defensible thing — verifiable ground truth — and becoming an undifferentiated, under-funded Glean clone.** The moment PlanMap ingests Slack/email as primary intent signals and answers general company questions, (1) it re-enters the incumbent bloodbath where it's outgunned; (2) it dilutes the "provably true" promise with unverifiable human chatter (a stale Slack claim contradicting the verified schema *degrades* trust in the map); (3) it explodes scope, connector maintenance, and permission/compliance surface (email/Slack security review is brutal and slow); and (4) it blurs the buyer, lengthening sales cycles. Secondary risk: the YC RFS guarantees a swarm of "company brain" startups in 2026 — chasing the generic version means competing on their crowded terms instead of PlanMap's unique code+system ground.

**(e) One-sentence verdict.**
**Pursue "company brain" as *north-star narrative* but not as *near-term product*: stay the executable, drift-checked, verifiable map of the *system* (the differentiated 60% YC says is unsolved), add comms/non-technical layers only as grounded read-outs on top of that verified core — never let Slack/email become a co-equal source of truth that dissolves the moat.**

---

## Sources
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
