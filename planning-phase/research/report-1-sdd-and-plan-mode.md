# PlanMap — Market & Competitive Research Report

**Prepared for:** PlanMap startup vision doc
**Date:** 2026-07-17
**Scope:** AI coding-tools / developer-tools market, spec-driven & planning-layer landscape, competitive positioning, GTM, risks.
**Method note:** Figures below are drawn from 2025–2026 primary and secondary sources, cross-checked where possible. Market-research-firm numbers are directional (methodologies differ widely); startup traction is verified against ≥2 sources where available. Numbers I could not independently corroborate are flagged **[unverified]**. Inline citations `[n]` map to the Sources list.

---

## 1. Executive summary

1. **The category is real and hot.** The AI code-tools market is ~$7.4–8.5B in 2025 and ~$9.4–10.3B in 2026, growing ~23–28% CAGR toward $26–43B by 2030–2033 across four independent forecasters [1][2][3][4][5]. PlanMap rides this wave but is *not* a code generator — it is a governance/planning layer above the generators.
2. **The pain PlanMap targets is now quantified, not anecdotal.** ~84–90% of developers use AI tools [6][9], yet the 2025 DORA report finds ~30% have "little or no trust" in AI-generated code and >60% have found AI-introduced errors *after* deployment; software-delivery *instability is rising* even as throughput improves [9][10][11].
3. **AI is measurably degrading codebase health.** GitClear's 2025 study (211M+ lines) found duplicated code blocks rose ~8× in 2024, copy/paste climbed from 8.3%→12.3% of changes (2021→2024), refactoring collapsed from 25%→<10%, and short-term churn nearly doubled [7][8]. This is the "loss of architectural intent" PlanMap addresses.
4. **Spec-driven development (SDD) is the fastest-moving methodology in dev tooling.** GitHub Spec Kit hit ~90k–111k GitHub stars within ~9 months [12][14]; AWS built an entire IDE (Kiro) around it [18][19][20]. This validates PlanMap's "approve the plan before code" premise — but also means giants are already in the adjacent space.
5. **The wedge is Impact Analysis, not planning.** Plan graphs and "plan mode" are becoming table stakes (Cursor, Claude Code ship them natively [29][33]). PlanMap's genuinely differentiated feature is **static-analysis-grounded impact analysis** ("what breaks," with the LLM only explaining *why*) — this is the anti-hallucination angle no incumbent leads with.
6. **The closest cautionary tale is dead.** CodeSee (code visualization/maps/"tours," ~$10M seed) wound down in Feb 2024 and its assets went to GitKraken by mid-2024 [43][44][45]. Lesson: *pretty codebase visualization alone doesn't convert*; PlanMap must tie visuals to an action loop (impact + drift), not be a map.
7. **Drift detection is defensible-ish but copyable.** An OSS tool literally named "Drift" already does static-analysis architectural-erosion detection for AI code [46][47]. PlanMap's edge is not "detecting drift" but *drift against an explicitly approved plan node plus the stored rationale* — the combination, not the primitive.
8. **The `.planmap/` + annotations store is the strongest moat candidate.** Per the 2026 "AI agents stack" thesis, the *model/harness/UI layers are rental; context/schema/verification layers are owned* [48]. A git-committed, plain-JSON plan + rationale graph is exactly an "owned" data layer — but its lock-in is only real if annotations accumulate value teams won't abandon.
9. **Incumbents can copy features; they're less likely to copy the *neutral position*.** Cursor, Copilot, Kiro, Claude Code each want you *in their agent*. PlanMap's "one layer above, IDE/agent-agnostic, BYO-key" stance is a structurally different bet that vendors are disincentivized to make.
10. **Funding gravity is enormous and concentrated in code-*generation*.** Cursor/Anysphere reached a $29.3B valuation and $2B ARR by early 2026 [27][28]; Claude Code hit ~$2.5B run-rate [32]; Tessl raised $125M at ~$500–750M on "spec-as-source" [40][41]. PlanMap is not competing for those dollars — it's a thin, cheap, complementary layer, which is both a survival advantage and a fundraising handicap.
11. **Consolidation is violent.** Windsurf was dismembered across Google/Cognition in 72 hours [34][35][50]; CodeSee absorbed into GitKraken [44]; Sourcegraph split Cody (enterprise) from Amp (new co.) [37][39]. Tooling built *on top of* one vendor is fragile; PlanMap's agnosticism is a hedge.
12. **Best GTM wedge: solo devs + small teams via VS Code Marketplace + npm CLI, BYO-key, free/cheap core**, expanding to team-lead "plan review" and eng-productivity/platform buyers. Comparable price points cluster at $10–20/seat (Copilot Pro, Kiro Pro) with usage credits [18][30].
13. **The untested core assumption is the #1 risk:** does an *editable graph* actually beat *chat + markdown specs* for real developers? SDD today is overwhelmingly markdown-file-based (Spec Kit, OpenSpec, Kiro all emit `.md`) [13][22]. PlanMap bets the visual/graph UX is worth the added surface area — unproven.
14. **Technical risk is real:** cross-language static analysis that is accurate enough to be trusted (and not itself hallucinate dependencies) is hard; false positives kill trust faster than missing edges.
15. **Recommendation:** ship the impact-analysis + drift loop as the hero, treat the plan graph as the on-ramp, stay ruthlessly agnostic and local-first, price near-free to seed adoption, and instrument whether teams *keep and reuse* annotations — that metric is the real signal of a moat.

---

## 2. The problem & "why now"

**Vibe coding went mainstream, then hit a quality wall.** Developer AI adoption rose to ~84% (from ~76% in 2024) on survey aggregates [6], and the 2025 DORA report puts AI usage at ~90% of technology professionals with >80% reporting productivity gains [9][10]. But the same report documents an **instability paradox**: throughput is up, yet software-delivery instability keeps rising, and the "fail fast, fix fast" hypothesis (that speed offsets breakage) is *not* supported by the data [9][11]. DORA's framing — "AI is an amplifier," making strong teams stronger and weak teams worse [10][11] — is the strategic backdrop for a governance layer.

**Trust is low and falling.** DORA 2025 finds ~30% of developers have little/no trust in AI-generated code and >60% have found AI-related errors after deployment [9][10]. Secondary survey aggregates report a sharper trust decline (roughly 40%→~29–33% year-over-year) and that a large share of developers deploy AI code they don't fully review [6]; treat the exact percentages as **[unverified / vendor-compiled]**, but the direction is corroborated by DORA.

**Codebase health is measurably eroding.** GitClear's 2025 report (211M+ changed lines) is the most-cited primary evidence: duplicated code blocks increased ~8× in 2024; "copy/pasted" lines rose 8.3%→12.3% (2021→2024) while refactoring ("moved" lines) fell from 25%→<10%; all-line churn rose 3.3%→5.7%, and ~7.9% of new code was revised within two weeks [7][8]. Independent claims that AI code carries ~1.7× more issues and ~2.7× more security vulnerabilities circulate widely [6] but originate in vendor blogs — **[unverified]**; cite cautiously.

**The specific gap PlanMap names — loss of architectural intent.** Chat-based agent workflows discard the *why*: the reasoning behind a decision lives in an ephemeral transcript, not in the repo. As AI writes more code faster, the human's mental model of "what this system is supposed to do and why" degrades — this is classic **architectural drift/erosion**, now accelerated. Academic and tooling literature treats erosion detection via dependency-graph and fitness-function analysis as a known-hard problem [46][47], and a wave of "architecture drift" tooling explicitly aimed at AI-generated code appeared in 2025–2026 [46].

**Why now — the SDD inflection.** Spec-driven development crystallized as a named movement in 2025: Sean Grove's "The New Code" talk, GitHub's **Spec Kit** (open-sourced Sept 2025, ~90k–111k stars by mid-2026) [12][14], **AWS Kiro** (spec-first IDE, GA Nov 2025) [18][19], **OpenSpec** (lightweight OSS SDD) [22][23], and Tessl's radical "spec-as-source" [40], with Thoughtworks/Martin Fowler providing a sober taxonomy [12]. The core SDD thesis — *the spec, not the prompt or the code, is where human intent lives, so it should be written first and kept as source of truth* [13] — is precisely PlanMap's premise. The window is open **now** because (a) the pain is acute and quantified, (b) the methodology has social proof, and (c) the tooling is still immature and overwhelmingly markdown-file-based, leaving room for a better intent-capture + impact-analysis UX.

---

## 3. Market sizing

**TAM (top-down, category).** The "AI code tools / AI code assistants" market in 2025 is estimated at:
- Mordor: **$7.37B (2025) → $9.35B (2026)**, $29.96B by 2031, 26.2% CAGR [1].
- The Business Research Company / Research&Markets: **$7.65B (2025) → $9.46B (2026)**, 23.7% CAGR [2].
- Grand View (AI code *assistants*): **$8.5B (2025) → $10.3B (2026) → $42.8B by 2033**, 22.5% CAGR [3].
- Precedence: **$7.93B (2025) → ~$91B by 2035**, 27.7% CAGR [4].
- Grand View (AI code *tools*): $4.86B (2023) → $26.03B by 2030, 27.1% CAGR [5].

Consensus: **~$7.4–8.5B in 2025, ~$9.4–10.3B in 2026, >20% CAGR.** These count code-*generation* tools; PlanMap sits adjacent, so this is the outer TAM, not PlanMap's serviceable market.

**SAM (analyst-derived, bottom-up — treat as illustrative, not sourced).** PlanMap monetizes professional developers/teams that use AI coding agents and care about plan governance. Using commonly cited developer-population figures (GitHub reports 100M+ accounts; SlashData/industry estimates put professional developers at ~25–30M+ globally — **[unverified in this report]**) and ~90% AI-tool penetration [9]:
- Addressable population ≈ 25–30M professional devs × ~90% AI users ≈ **~22–27M seats**.
- Realistic serviceable subset (teams/individuals who will pay for a planning/governance layer, not just codegen) ≈ **10–20% ≈ 3–5M seats**.
- At a comparable **$12–20/seat/mo** (Copilot Pro $10, Copilot Business $19, Kiro Pro $20 [18][30]) → **SAM ≈ $0.5–1.2B/yr.** *Assumptions stated; derivation is mine and unverified.*

**SOM (3-year, realistic for a solo/tiny team, BYO-key, freemium/OSS-led).** Bottom-up, self-derived:
- Conservative: 2,000–5,000 paying seats × ~$15/mo ≈ **$0.4–0.9M ARR**.
- Ambitious-but-plausible: ~20,000 paying seats ≈ **~$3.6M ARR**, plausible only with strong OSS/marketplace virality and a team tier.
- These are order-of-magnitude planning numbers, **not forecasts**; the binding constraints are distribution and conversion, not market size.

**Key sizing caveat:** PlanMap's category ("AI planning/governance layer") has *no clean analyst market* yet — it's a slice of dev-tools + a slice of AI-code-quality/SDLC-governance. That's both opportunity (uncontested) and risk (buyers may not have a budget line for it).

---

## 4. Competitive landscape

PlanMap's competitors fall into four buckets: **(A) code understanding/visualization**, **(B) spec-driven-development tooling**, **(C) coding agents with native planning**, and **(D) drift/architecture-erosion tools**. No single competitor does PlanMap's exact triad (plan graph + static-analysis impact analysis + plan-anchored drift detection), but each covers part of it.

### A. Code understanding / visualization

**DeepWiki (Cognition / Devin).** Auto-generates wiki-style docs for any GitHub repo — architecture diagrams (Mermaid), module pages, source links, and RAG-grounded conversational Q&A; free for public repos [16][17]. *Does well:* zero-effort comprehension of unfamiliar code; strong distribution (github.com→deepwiki.com URL trick) and Cognition's brand/capital (Cognition valued ~$10.2B post-Windsurf [36]). *Gaps vs PlanMap:* read-only *understanding*, not forward *planning*; no plan-approval gate, no impact analysis on edits, no drift-against-plan. *Could it add PlanMap features?* Yes technically — but it's positioned as documentation, and Cognition's strategic energy is on Devin/agents, not a governance layer.

**CodeSee (DEAD — the cautionary tale).** Codebase "maps," visual diagrams, and "code tours" for onboarding/understanding; raised ~$10M seed ($3M 2021 + $7M 2022; founder Shanea Leven) [43]. Wound down operations in **Feb 2024**; assets/IP absorbed by **GitKraken (~mid-2024)**, product sunset [44][45]. *Why it died:* strong free-user growth but **inconsistent, slow revenue** — visualization was a "nice to have" that didn't attach to a recurring, budget-owning workflow. **Direct lesson for PlanMap:** a beautiful graph is not a business; the graph must be the entry point to a *repeated, value-generating action loop* (approve plan → analyze impact → detect drift). PlanMap's thesis explicitly does this, but must prove the loop is sticky.

### B. Spec-driven development tooling

**AWS Kiro.** Spec-first agentic IDE (fork of VS Code): turns prompts into `requirements.md` (EARS syntax), `design.md`, `tasks.md`, plus automated hooks and steering files [18][20]. **GA Nov 2025** with team features and Kiro CLI (preview launched Jul 2025) [19]. Pricing: Free / **Pro $20 / Pro+ $40 / Power $200** per month on a *credit* model (~$0.04/vibe request, higher for spec requests) [18]. *Note:* a **botched pricing change in Aug 2025** ("wallet-wrecking") triggered a public backlash and refunds — a credit-model trust wound worth learning from [21]. *Does well:* deep spec→code→test loop, AWS integration, real spec artifacts. *Gaps vs PlanMap:* markdown specs (not an editable visual graph), no static-analysis impact analysis on plan edits, drift is not the product; also it's an *IDE you switch to* (lock-in), the opposite of PlanMap's agnostic layer. *Could add drift/visual planning?* Yes — this is the most credible large-vendor threat to PlanMap's SDD flank.

**GitHub Spec Kit.** OSS toolkit + `specify` CLI implementing `/specify → /plan → /tasks → /implement`; ~90k–111k stars, 30+ agent integrations (Claude Code, Copilot, Cursor, Gemini, Codex) [12][14]. *Does well:* free, agent-agnostic, enormous mindshare, GitHub's distribution. *Gaps vs PlanMap:* pure markdown artifacts and slash-command workflow — **no visual graph, no impact analysis, no drift detection.** It defines the *format war* PlanMap must interoperate with rather than fight. *Could add features?* GitHub could, but Spec Kit is deliberately a lightweight scaffold; deep static analysis is off-thesis.

**OpenSpec (Fission-AI).** Lightweight OSS SDD framework — proposals/specs/design/tasks as folders in the repo, works across 30+ assistants, no vendor lock-in or API key [22][23]. *Does well:* minimal, local-first, agnostic — philosophically closest to PlanMap's `.planmap/` ethos. *Gaps vs PlanMap:* again markdown, no graph, no impact/drift engine. *Signal:* validates the "spec artifacts committed to git, tool-agnostic" model PlanMap also adopts.

**Tessl.** Guy Podjarny's (Snyk founder) "AI-native / spec-as-source" company; **$125M raised ($25M seed + $100M Series A), ~$500–750M valuation (Nov 2024)**, backers Index/Accel/GV/boldstart [40][41][42]. *Does well:* radical vision (spec as the durable artifact, code regenerable), heavyweight founder/capital, framework + registry ambitions. *Gaps vs PlanMap:* far more ambitious/heavier ("rewrite how software is made"); PlanMap is a pragmatic overlay on existing agents. *Threat:* well-funded and thematically overlapping; if Tessl ships approachable impact/visual tooling it competes for the same "intent lives in the spec" narrative.

### C. Coding agents with native planning (commoditization threat)

**Cursor (Anysphere).** Dominant AI IDE; **$29.3B valuation (Nov 2025, $2.3B round), ~$500M ARR (Jun 2025) → $1B (Nov 2025) → $2B ARR (early 2026)** [27][28]. Ships **Plan Mode** (agent researches, writes a reviewable/editable plan before editing) [29]. *This is the core commoditization risk:* "review a plan before the agent codes" is now a free built-in feature. *Gaps vs PlanMap:* plan is chat/markdown-ish and ephemeral; no static-analysis impact graph, no persisted drift-against-approved-plan, single-agent lock-in. (Note: reports of a ~$50B round and a rumored SpaceX acquisition are **[unverified / rumor]** — excluded from analysis.)

**GitHub Copilot.** Free / **Pro $10 / Pro+ $39 / Max $100**; **Business $19 / Enterprise $39** per seat, hybrid seat + AI-credit model (1 credit = $0.01) [30]. **Copilot Workspace** (the "plan then build" preview) was **sunset May 30, 2025**, its ideas folded into agent mode + **Copilot Spaces** (persistent grounding context, GA Sept 2025) [31]. *Lesson:* even GitHub's own "planning-first" product didn't survive as a standalone — the market pulled toward integrated agents. *Gaps vs PlanMap:* no editable plan graph, no impact analysis, no drift; but distribution is unmatched.

**Claude Code (Anthropic).** CLI agent with an enforced read-only **Plan Mode** (Shift+Tab) [33]; run-rate revenue ~$1B (Nov 2025) → ~$2.5B (Feb 2026), a key driver of Anthropic's surge to ~$14B+ ARR [32][49]. *Gaps vs PlanMap:* plan mode is a gate, not a persisted, visual, impact-aware graph; transcripts lose the *why*. **This is a primary integration target *and* a competitor** — PlanMap explicitly sits above Claude Code.

**Windsurf (now Cognition).** Formerly a top AI IDE; **dismembered in July 2025** — Google licensed its tech for ~$2.4B and hired the CEO/co-founder; Cognition acquired the remaining product/brand/customers days later [34][35][50]. *Relevance:* less a direct competitor now than the definitive proof that **building your product on one agent vendor is existentially risky** — reinforcing PlanMap's agnostic hedge.

**Sourcegraph — Amp / Cody.** Cody repositioned **enterprise-only ($59/user/mo)**, with Free/Pro **terminated Jul 23, 2025**; individual devs pushed to **Amp** (agentic, free, ad-supported experiment). In **Dec 2025 the company split Amp into a separate company (Amp Inc.)** [37][38][39]. *Does well:* deep code search / codebase context at enterprise scale. *Gaps vs PlanMap:* search + agent, not plan-graph/impact/drift. *Signal:* even a code-intelligence leader is thrashing on model/monetization — the underlying primitives (indexing, graphs) are increasingly commoditized.

### D. Drift / architecture-erosion tools

**"Drift" (OSS, github.com/sauremilk/drift) and similar.** A static analyzer *explicitly built to detect architectural erosion from AI-generated code* — pattern fragmentation, architecture violations, "mutant duplicates" — with a GitHub Action [46][47]. Plus established fitness-function/dependency tools (ArchUnit, Deptrac, go-arch-lint) [46]. *Direct implication:* **PlanMap's "drift detection" primitive is already commoditized/copyable.** PlanMap's only defensible version is *drift measured against an explicitly human-approved plan node, with the stored rationale* — i.e., drift **relative to intent**, not just relative to generic architectural rules.

### Comparison table

| Product | Category | Plan artifact | Impact analysis (what breaks) | Drift detection | Agent-agnostic | Local/git-native | Pricing | Traction / funding |
|---|---|---|---|---|---|---|---|---|
| **PlanMap** | Planning/governance layer | **Editable visual graph + lenses** | **Yes — static-analysis-grounded, LLM explains *why*** | **Yes — vs approved plan node, stores *why*** | **Yes (VS Code + CLI + web)** | **Yes (`.planmap/` JSON in git)** | TBD (freemium/BYO-key) | Pre-launch, solo/tiny team |
| DeepWiki (Cognition) | Understanding/docs | Auto-wiki + Mermaid | No | No | Reads any repo | No (hosted) | Free (public repos) | Cognition ~$10.2B val [36] |
| CodeSee (dead) | Visualization | Maps / tours | No | No | n/a | Partial | Sunset | ~$10M seed; sunset 2024 [43][44] |
| AWS Kiro | Spec-driven IDE | `requirements/design/tasks.md` | No (test-driven) | No | No (own IDE) | Files in repo | $20/$40/$200 + credits [18] | AWS-backed; GA Nov 2025 [19] |
| GitHub Spec Kit | SDD toolkit (OSS) | Markdown + slash cmds | No | No | Yes (30+ agents) | Yes | Free/OSS | ~90–111k stars [12][14] |
| OpenSpec | SDD framework (OSS) | Markdown folders | No | No | Yes (30+) | Yes | Free/OSS | OSS, growing [22] |
| Tessl | Spec-as-source platform | Spec (source of truth) | Partial (regenerate) | Implicit | Framework-level | Registry-based | Not public | $125M, ~$500–750M val [40][41] |
| Cursor | Agent IDE | **Plan Mode** (editable) | No (LLM-guessed) | No | No (own IDE) | Partial | ~$20/seat + usage | $29.3B val, ~$2B ARR [27][28] |
| GitHub Copilot | Agent/assistant | (Workspace sunset) → Spaces | No | No | GitHub ecosystem | No | $10–$39 seat + credits [30] | GitHub/MSFT scale [31] |
| Claude Code | CLI agent | **Plan Mode** | No | No | Anthropic models | Partial | Usage / subscription | ~$2.5B run-rate [32] |
| Sourcegraph Amp/Cody | Search + agent | No | Partial (code intel) | No | Cody enterprise | No | Cody $59; Amp free [38][39] | Split into 2 cos. Dec 2025 [37] |
| "Drift" (OSS) | Erosion detection | No | No | **Yes (generic rules)** | Yes (CI) | Yes | Free/OSS | Nascent [46][47] |

---

## 5. PlanMap's differentiation & moat (adversarial)

**Steelman the competitors first.**
- *Cursor/Claude Code plan modes* already give a free "review the plan before coding" gate to millions of developers [29][33]. For most users, that may be "good enough," and it lives *inside the tool they already use* — zero context-switch.
- *Kiro/Spec Kit/OpenSpec* already persist spec artifacts in the repo, agent-agnostically, for free [14][22]. The "intent committed to git" idea is not novel to PlanMap.
- *DeepWiki* already gives instant architecture diagrams and RAG Q&A over any repo for free [16].
- *"Drift" and fitness-function tools* already detect architectural erosion via static analysis in CI [46][47].
- *Tessl* has $125M and a Snyk-caliber founder chasing the same "spec is the durable truth" narrative [40].

**Now, what is genuinely defensible for PlanMap?**

1. **The *combination* is uncontested, even if each part isn't.** No incumbent ships *plan graph + static-analysis impact analysis + plan-anchored drift + stored rationale* as one loop. Category creation via integration is a legitimate strategy — but integrations are copyable, so this is a *time-to-market* advantage, not a permanent moat.

2. **Static-analysis-grounded impact analysis is the sharpest, most defensible wedge.** Everyone else's "what will this affect?" is either absent or LLM-guessed (hallucination-prone). PlanMap's design decision — *dependencies come from parsers; the LLM only narrates the why* — is a credibility position competitors *structurally under-invest in* because they're incentivized to showcase LLM magic, not constrain it. **This is the thing to lead with.** Caveat: building trustworthy cross-language static analysis is genuinely hard; accuracy *is* the moat here, and it's an engineering moat you must earn.

3. **Drift-*against-approved-intent* beats generic drift.** OSS "Drift" flags deviation from architectural rules [46]; PlanMap flags deviation from *a specific plan node a human approved, with the recorded rationale.* That semantic link (code ↔ approved intent ↔ why) is hard to replicate without PlanMap's data model — but it depends entirely on users actually approving and annotating plans.

4. **The `.planmap/` + annotations store — the real moat question.** The 2026 "AI agents stack" thesis is that model/harness/UI are *rented* while context/schema/verification are *owned* [48]. A git-committed, plain-JSON graph of plans + rationale is an "owned" layer, and it's portable/inspectable (a trust advantage over hosted black boxes). **But be adversarial:** lock-in is only real if (a) annotations accumulate faster than they rot, (b) teams *reuse* them (drift checks, onboarding, audits) often enough to feel loss on leaving, and (c) the format doesn't get trivially subsumed by a standard (e.g., if Spec Kit adds a graph view + annotations, the moat erodes). Plain JSON in git is *anti-lock-in by design* — which is great for adoption and *bad for defensibility*. The moat is therefore **behavioral (accumulated, reused rationale), not technical.**

5. **Neutrality is a structural moat the giants won't copy.** Cursor, Copilot, Kiro, Claude Code, Amp each want to *own the developer's session*. A vendor cannot credibly be "the neutral layer above all agents" while also being an agent — it's a conflict of interest. PlanMap being agent/IDE-agnostic, local-first, and BYO-key is a position incumbents are *disincentivized* to occupy. This is the most durable non-technical differentiator.

**Where the moat is thin (be honest):**
- Plan graphs and plan review → **already commoditized** by native plan modes.
- Drift detection primitive → **already copyable** (OSS exists).
- `.planmap/` portability → **great for trust, weak for lock-in.**
- A well-capitalized SDD player (Tessl) or a giant (GitHub/AWS) could bolt a graph UI + impact view onto existing spec tooling in a quarter or two.

**Net:** the defensible core is **(impact analysis accuracy) × (drift-against-intent semantics) × (neutral, local-first positioning)**, compounded by **accumulated annotation data**. Lead with impact analysis; treat the plan graph as the on-ramp; make annotations sticky through reuse.

---

## 6. Go-to-market

**Buyers / users (in expansion order):**
1. **Solo devs & indie hackers** — the beachhead. They feel the "AI wrote something that broke elsewhere" pain daily, adopt via marketplace/CLI with no procurement, and are reachable through OSS/content. Low ARPU but high volume and virality.
2. **Team leads / senior engineers** — the "plan review" buyer. They want a gate where they approve architecture before juniors + agents run. This is where "plan graph + impact" becomes a *workflow*, not a toy.
3. **Platform / eng-productivity / DevEx teams** — the budget owner. They buy tools that reduce instability and rework (directly tied to DORA metrics [9]). Pitch: "measurable drift/rework reduction across teams."
4. **Enterprise (later)** — governance, audit, "prove the code matches approved intent," compliance. Higher ACV but heavy requirements (SSO, on-prem, security review) that a solo team should defer.

**Distribution (multi-front, matching the "core-first" architecture):**
- **VS Code Marketplace** — primary top-of-funnel; where developers already install tooling; free tier drives installs.
- **CLI via npm** — fits CI and terminal-native agent workflows (Claude Code, Kiro CLI, Amp CLI all validate terminal demand [19][39]); enables drift checks as a CI gate (the "GitHub Action" pattern "Drift" already uses [47]).
- **OSS core / open format** — Spec Kit and OpenSpec prove OSS-led SDD distribution works; an open `.planmap/` spec invites integrations and trust.
- **Web app (later)** — for cross-team dashboards, review/approval, and non-IDE stakeholders (PM/architect "lenses").
- **Agent-agnostic integrations** — position as the layer that works *with* Claude Code / Cursor / Copilot rather than replacing them (co-exist, don't compete for the editor).

**Pricing — comparables and recommendation.** Comparable anchors: Copilot Free/$10/$19/$39 [30]; Kiro Free/$20/$40/$200 with credits [18]; Cursor ~$20/seat + usage [27]; Cody enterprise $59 [39]; Spec Kit/OpenSpec/DeepWiki free [14][16][22]. Two hazards to avoid: (a) **credit-model backlash** (Kiro's Aug 2025 fiasco [21]) — since PlanMap is BYO-LLM-key, *avoid metering LLM usage at all*; charge for the tool, not tokens; (b) **free-can't-convert** (CodeSee's death [44]) — the free tier must be genuinely useful but the *team/collaboration + drift-in-CI + audit* value must sit behind a paid tier.
- **Recommendation:** **Free** solo tier (full plan graph + impact analysis, single user, local). **Team $12–19/seat/mo** (shared plans, approval workflow, drift-in-CI, cross-repo). **Enterprise (custom)** later (SSO, audit, on-prem, support). BYO-key throughout — turn the "no LLM margin" constraint into a *trust* selling point ("we never see your code or your keys").

**Wedge → expansion path:** *Solo dev installs for impact analysis (avoid breaking things) → invites team for plan approval → team adopts drift-in-CI → platform team standardizes it for rework/instability reduction → enterprise governance/audit.* Land on individual pain, expand on team workflow, monetize on org-level governance.

---

## 7. Key risks & unknowns

**The untested core assumption (highest risk).** *Does an editable, zoomable plan graph actually beat chat + markdown specs for real developers?* Every shipping SDD tool today is markdown-file-based (Spec Kit, OpenSpec, Kiro) [13][22]; native plan modes are chat/text [29][33]. Developers have repeatedly rejected heavier visual layers (CodeSee's maps didn't convert [44]). PlanMap bets the graph + "lenses" UX is worth the added cognitive/maintenance surface. **This must be validated with real users before over-building** — e.g., ship the impact-analysis value even for users who barely touch the graph.

**Market risks.**
- No existing budget line for "AI planning/governance layer" — buyers may not know they should pay for it.
- The pain, while real, may be absorbed by incumbents' free plan modes for the majority, leaving only a high-end sliver.
- Category could get subsumed: if Spec Kit/Kiro add a graph + impact view, PlanMap's whitespace shrinks fast.

**Technical risks.**
- **Static-analysis accuracy across languages is hard.** The whole credibility pitch ("we don't hallucinate dependencies") collapses if the parser-based impact graph has too many false positives/negatives. Trust is asymmetric: a few wrong "this will break" calls destroy adoption.
- **Drift detection signal-to-noise.** Flagging drift too eagerly becomes alarm fatigue (the lesson from noisy linters); too little and it's invisible.
- **Keeping the plan graph in sync** with fast-moving AI-generated code is a moving-target problem.

**Competitive risks.**
- **Fast-follow by giants** (GitHub, AWS, Anthropic) or well-funded SDD players (Tessl, $125M [40]) — features are copyable in a quarter.
- **Platform dependency / consolidation whiplash** — the Windsurf dismemberment [35][50] and Sourcegraph split [37] show how fast the substrate shifts; agnosticism mitigates but doesn't eliminate this.
- **OSS commoditization** — "Drift" already gives away erosion detection [46]; Spec Kit/OpenSpec give away SDD scaffolding [14][22]. PlanMap must out-execute on the *integrated loop + accuracy*, not the primitives.

**Business/execution risks (solo/tiny team).**
- Building trustworthy cross-language static analysis + a polished multi-surface product (VS Code + CLI + web) is a large scope for a tiny team; **sequence ruthlessly** (one language, one surface, the impact-analysis hero first).
- Low ARPU freemium requires either large volume (distribution risk) or fast team-tier conversion (proven-value risk).

**Key unknowns to resolve early (proposed validation metrics):**
1. Do users *approve* plans (engagement with the gate)?
2. Do they *keep and reuse* annotations over time (the real moat signal)?
3. Does impact analysis change behavior (fewer reverts/rework — measurable via git churn, echoing GitClear's methodology [7])?
4. Will they run drift checks in CI (workflow stickiness)?
5. Graph vs. markdown preference (A/B the core assumption).

---

## 8. Sources

1. Mordor Intelligence — AI Code Tools Market: https://www.mordorintelligence.com/industry-reports/artificial-intelligence-code-tools-market
2. The Business Research Company — AI Code Tools Global Market Report: https://www.thebusinessresearchcompany.com/report/artificial-intelligence-ai-code-tools-global-market-report
3. Grand View Research — AI Code Assistants Market Report: https://www.grandviewresearch.com/industry-analysis/ai-code-assistants-market-report
4. Precedence Research — AI Code Tools Market: https://www.precedenceresearch.com/ai-code-tools-market
5. Grand View Research — AI Code Tools Market Report: https://www.grandviewresearch.com/industry-analysis/ai-code-tools-market-report
6. Hostinger — Vibe coding statistics 2026 (adoption/quality/security; secondary aggregate): https://www.hostinger.com/blog/vibe-coding-statistics/
7. GitClear — AI Copilot Code Quality 2025 Research: https://www.gitclear.com/ai_assistant_code_quality_2025_research
8. GitClear — AI Copilot Code Quality 2025 (PDF): https://gitclear-public.s3.us-west-2.amazonaws.com/GitClear-AI-Copilot-Code-Quality-2025.pdf
9. DORA — State of AI-assisted Software Development 2025: https://dora.dev/dora-report-2025/
10. Google Cloud — Announcing the 2025 DORA Report: https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report
11. InfoQ — DORA Report Finds AI Is an Amplifier, Trust Remains Low: https://www.infoq.com/news/2025/09/dora-state-of-ai-in-dev-2025/
12. Martin Fowler — Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl: https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
13. GitHub Blog — Spec-driven development with AI: open source toolkit: https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
14. GitHub — Spec Kit repository: https://github.com/github/spec-kit
15. Augment Code — Best Spec-Driven Development Tools: https://www.augmentcode.com/tools/best-spec-driven-development-tools
16. Cognition — DeepWiki: AI docs for any repo: https://cognition.com/blog/deepwiki
17. Devin Docs — DeepWiki: https://docs.devin.ai/work-with-devin/deepwiki
18. Kiro — Pricing: https://kiro.dev/pricing/
19. SiliconANGLE — AWS launches Kiro into general availability (team features, CLI): https://siliconangle.com/2025/11/17/aws-launches-kiro-general-availability-team-features-cli-support/
20. Forbes — AWS Launches Kiro, A Specification-Driven Agentic IDE: https://www.forbes.com/sites/janakirammsv/2025/07/15/aws-launches-kiro-a-specification-driven-agentic-ide/
21. The Register — AWS pricing for Kiro dev tool 'a wallet-wrecking tragedy': https://www.theregister.com/2025/08/18/aws_updated_kiro_pricing/
22. GitHub — Fission-AI/OpenSpec: https://github.com/Fission-AI/openspec
23. OpenSpec — official site: https://openspec.dev/
24. PitchBook — Augment Code company profile: https://pitchbook.com/profiles/company/530746-75
25. redreamality — Why is Augment Code worth $1 billion? (investor breakdown): https://redreamality.com/garden/questions/augment-code-investor-breakdown/
26. Augment Code — Factory AI vs Augment Cosmos: https://www.augmentcode.com/tools/factory-ai-vs-augment-cosmos
27. CNBC — Cursor raises $2.3B at $29.3B valuation: https://www.cnbc.com/2025/11/13/cursor-ai-startup-funding-round-valuation.html
28. TechCrunch — Cursor's Anysphere nabs $9.9B valuation, soars past $500M ARR: https://techcrunch.com/2025/06/05/cursors-anysphere-nabs-9-9b-valuation-soars-past-500m-arr/
29. Learn Cursor — Agent Plan Mode: https://www.learncursor.dev/learn/cursor-agents/agent-plan-mode
30. GitHub — Copilot Plans & pricing: https://github.com/features/copilot/plans
31. Java Code Geeks — GitHub Copilot Workspace & The Agentic Era (Workspace sunset / Spaces): https://www.javacodegeeks.com/2026/02/github-copilot-workspace-the-agentic-era.html
32. SaaStr — Anthropic Hits $14B ARR (Claude Code run-rate): https://www.saastr.com/anthropic-just-hit-14-billion-in-arr-up-from-1-billion-just-14-months-ago/
33. ClaudeLog — Claude Code Plan Mode mechanics: https://claudelog.com/mechanics/plan-mode/
34. CNBC — Cognition to buy Windsurf after Google poached CEO: https://www.cnbc.com/2025/07/14/cognition-to-buy-ai-startup-windsurf-days-after-google-poached-ceo.html
35. TechCrunch — Cognition acquires Windsurf: https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/
36. CNBC — Cognition valued at $10.2B two months after Windsurf purchase: https://www.cnbc.com/2025/09/08/cognition-valued-at-10point2-billion-two-months-after-windsurf-.html
37. Sourcegraph — Changes to Cody Free, Pro, and Enterprise Starter plans: https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans
38. Sourcegraph — Pricing: https://sourcegraph.com/pricing
39. WeavAI — Sourcegraph Cody Review 2026 ($59/mo enterprise; Amp): https://weavai.app/blog/en/2026/04/30/sourcegraph-cody-review-2026-enterprise-ai-at-59-mo/
40. TechCrunch — Tessl raises $125M at $500M+ valuation: https://techcrunch.com/2024/11/14/tessl-raises-125m-at-at-500m-valuation-to-build-ai-that-writes-and-maintains-code/
41. Fortune — Tessl worth ~$750M after new funding: https://fortune.com/2024/11/14/tessl-funding-ai-software-development-platform/
42. Tessl — Announcing Our Series A for AI Native Software Development: https://tessl.io/blog/announcing-our-series-a-for-ai-native-software-development/
43. GlobeNewswire — CodeSee Announces $7M in New Funding: https://www.globenewswire.com/news-release/2022/01/20/2370076/0/en/CodeSee-Announces-7M-in-New-Funding-to-Address-Rising-Demand-for-Code-Visualization-and-Understanding.html
44. Koalr — CodeSee Alternatives After the GitKraken Acquisition: https://koalr.com/blog/codesee-alternatives
45. Shanea Leven (LinkedIn) — CodeSee closes its doors: https://www.linkedin.com/feed/update/urn:li:activity:7163970333912289281
46. GitHub — sauremilk/drift: Detect architectural erosion from AI-generated code: https://github.com/sauremilk/drift
47. GitHub Marketplace — Drift: Architectural Erosion Check (Action): https://github.com/marketplace/actions/drift-architectural-erosion-check
48. O'Reilly Radar — The AI Agents Stack (2026 Edition): https://www.oreilly.com/radar/the-ai-agents-stack-2026-edition/
49. VentureBeat — Anthropic hits $30B revenue run rate: https://venturebeat.com/technology/anthropic-says-it-hit-a-30-billion-revenue-run-rate-after-crazy-80x-growth
50. DeepLearning.AI (The Batch) — Google, Cognition Carve Up Windsurf: https://www.deeplearning.ai/the-batch/google-cognition-carve-up-windsurf-after-openais-failed-3b-acquisition-bid

---

*Confidence & caveats: Market-firm TAM figures are directional and vary by methodology (§3). SAM/SOM are analyst-derived with stated assumptions, not sourced forecasts. Developer-population inputs are flagged unverified. Some traction figures (e.g., Cursor's later valuations, a rumored SpaceX acquisition) circulate but are unverified/rumor and were excluded from analysis. AI-code-defect multipliers (1.7×/2.7×) originate in vendor content and should be treated as indicative, not authoritative; the DORA and GitClear findings are the strongest primary evidence.*
