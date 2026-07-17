# PlanMap — Vision & Thesis

> **Doc 01 of the PlanMap planning-phase set.** This is the north-star document: what PlanMap is, the problem it exists to solve, the precise defensible moat, and why the window is open now. Every other planning doc must stay consistent with this one.
>
> **On evidence:** figures below are drawn from PlanMap Market Research Report #1 (SDD / AI plan-mode landscape). Inline `[n]` citations map to that report's numbered Sources list, reproduced in doc 02 (Market & Competition) and committed at `planning-phase/research/report-1-sdd-and-plan-mode.md`. Uncertainty flags (`[unverified]`) are preserved exactly as the report carries them — we do not launder vendor claims into facts.

---

## 1. Elevator Pitch

**PlanMap is the self-populating map of how your software actually works — across code, data, and cloud — that catches when reality drifts from what you approved, and lets AI agents act on it.**

It is a planning, governance, and comprehension layer that sits **one layer above** coding agents (Claude Code, Copilot, Cursor). It never writes code itself. It decides what the code *should* be, hands a precise, scoped instruction to whatever agent the developer already uses, and then tracks intent-versus-reality afterward by reading the real system.

Where a coding agent answers *"write this for me,"* PlanMap answers three questions the agents structurally cannot: **How should this work? If I change it, what breaks and why? And does what actually shipped still match what I approved?** The first is the Plan Graph, the second is Impact Analysis, the third is the Evolution Graph and its Drift signal. A fourth surface — Learn/Guide mode — turns the same auto-populated map into a living guide to real production for newcomers.

One engine, three editions (Solo, Team, Org). Agent-agnostic, local-first, and BYO-key by design.

---

## 2. The Problem, in Depth

The category PlanMap rides is real and hot: the AI code-tools market is roughly **$7.4–8.5B in 2025** and **$9.4–10.3B in 2026**, growing ~23–28% CAGR toward $26–43B by 2030–2033 across four independent forecasters [1][2][3][4][5]. But PlanMap is not a code generator. It targets the *wreckage the generators leave behind* — a pain that is now quantified, not anecdotal.

### 2.1 Vibe coding went mainstream, then hit a quality wall

AI adoption among developers has risen to roughly **84–90%** [6][9]; the 2025 DORA report puts usage at ~90% of technology professionals with >80% reporting productivity gains [9][10]. But the same report documents an **instability paradox**: throughput is up while software-delivery *instability keeps rising*, and the "fail fast, fix fast" hypothesis — that speed offsets breakage — is **not** supported by the data [9][11]. DORA's own framing is that **AI is an amplifier** — it makes strong teams stronger and weak teams worse [10][11]. Speed without a governing layer amplifies entropy as readily as output.

### 2.2 Trust is low, and the codebase is measurably eroding

DORA 2025 finds **~30% of developers have "little or no trust" in AI-generated code**, and **>60% have found AI-introduced errors *after* deployment** [9][10]. The most-cited primary evidence for *why* is GitClear's 2025 study of 211M+ changed lines [7][8]:

| Metric | Trend | Source |
|---|---|---|
| Duplicated code blocks | **~8× increase in 2024** | [7][8] |
| Copy/pasted lines (share of changes) | **8.3% → 12.3%** (2021→2024) | [7][8] |
| Refactoring ("moved" lines) | **25% → <10%** | [7][8] |
| All-line churn | **3.3% → 5.7%** | [7][8] |
| New code revised within two weeks | **~7.9%** | [7][8] |

The widely circulated claims that AI code carries ~1.7× more issues and ~2.7× more security vulnerabilities are **[unverified]** — they originate in vendor blogs [6] and should be treated as indicative, not authoritative. The DORA and GitClear findings are the strong primary evidence, and they point one way: more code, faster, with duplication rising and refactoring collapsing. That is architectural entropy, accelerated.

### 2.3 The loss of architectural intent

This is the specific gap PlanMap names. Chat-based agent workflows discard the ***why***. The reasoning behind a decision — *"per-email not per-IP, because our target market shares NAT"*; *"7-day refresh window, because users order weekly not daily"* — lives in an ephemeral transcript, never in the repo. As AI writes more code faster, the human's mental model of *what this system is supposed to do and why* degrades. This is classic **architectural drift/erosion**, and dependency-graph / fitness-function detection of it is a known-hard problem in the literature [46][47]; a wave of tooling aimed explicitly at AI-generated erosion appeared in 2025–2026 [46]. Six weeks after a "remember me" session window is silently hardcoded from 30 days to 24 hours, nothing breaks, tests pass — and nobody remembers there was ever a 30-day decision, or why. The intent evaporated the moment the chat scrolled off screen.

### 2.4 Juniors and newcomers lose the ability to understand their own system

The compounding cost of 2.1–2.3 falls hardest on the people with the least context. When intent lives only in transcripts and the codebase is a growing pile of duplicated, un-refactored, AI-authored blocks, a newcomer — or a junior who leaned on an agent to ship — cannot reconstruct *how the system works or why it is the way it is*. The amplifier effect [10][11] cuts both ways: teams that never had a durable mental model of their architecture now generate code faster than any human can internalize it. Comprehension tooling that helps here (e.g., auto-generated wikis) is read-only and rots the moment it is written; hand-authored onboarding tours (CodeSee's model) were a nice-to-have that never attached to a recurring workflow, and the company died for it (see §6). The unsolved need is a guide to *live production* that cannot go stale — the gap PlanMap's Learn/Guide mode is built for.

---

## 3. The Reframed Thesis & the Precise Moat

**Thesis.** The spec — the *intended* architecture and the *why* behind it — is where human intent belongs, and it should be captured before code, kept as a durable source of truth, and continuously reconciled against the real system. This is the core spec-driven-development (SDD) premise [13], now validated by the fastest-moving methodology in dev tooling. But planning alone is becoming table stakes: "review a plan before the agent codes" ships free inside Cursor, Claude Code, and Copilot [29][33][31]. **The wedge is not planning. It is the reconciliation of intent against reality, made trustworthy and executable.**

PlanMap's defensible whitespace is a precise combination that no incumbent fully owns. Five components, ranked by durability:

### 3.1 The cross-layer intent-vs-reality drift stitch (the core moat)

The defensible whitespace no incumbent fully owns is binding **code + DB schema + cloud + CI into ONE drift-checked, agent-executable graph**, where drift is measured against an *explicitly human-approved plan node* and the stored annotation preserves the *why*. Every adjacent player owns exactly one layer:

| Player | Owns | Does not stitch |
|---|---|---|
| Firefly | Infrastructure only | Code / DB / intent |
| Port, Cortex | Service catalog only | Code graph / cloud drift |
| Multiplayer | Architecture / APIs only | DB / cloud / CI |
| Sourcegraph | Code graph only | Cloud / DB / intent |
| OSS "Drift" [46][47] | Generic architectural rules | Approved-intent anchor + rationale |

Detecting drift is a commodity primitive — an OSS tool literally named "Drift" already flags AI-driven erosion in CI [46][47]. PlanMap's version is not "detect drift"; it is *drift relative to a specific node a human approved, with the recorded rationale, stitched across every layer of the stack.* That semantic link — **code ↔ DB ↔ cloud ↔ approved intent ↔ why** — is the thing that is hard to replicate.

### 3.2 Auto-population / freshness-by-construction (the wedge that makes the moat viable)

**Hand-maintained maps are a graveyard.** ServiceNow CMDBs decay, Backstage catalogs are famously "never completed," and CodeSee's hand-authored tours died with the company [43][44][45]. PlanMap must **NEVER** be a human-maintained catalog. The Evolution Graph is *derived by reading real code and infra* — not chat history, not a wiki someone forgot to update. The map populates itself, and drift re-verifies it continuously, so it cannot rot by construction. This is the wedge: it is the only reason the moat in §3.1 accumulates value instead of decaying into another abandoned catalog.

### 3.3 Neutrality (the structural moat incumbents won't copy)

Cursor, Copilot, Kiro, Claude Code, and Amp each want to *own the developer's session* [27][31][33]. A vendor cannot credibly be "the neutral layer above all agents" while also *being* an agent — it is a conflict of interest. PlanMap being **agent/IDE-agnostic, local-first, and BYO-key** is a position the giants are structurally disincentivized to occupy. Consolidation makes this a live hedge, not a slogan: Windsurf was dismembered across Google and Cognition in 72 hours [34][35][50] and Sourcegraph split Cody from Amp into a separate company [37][39]. Building *on top of* one vendor is existentially fragile; agnosticism is the survival bet.

### 3.4 Earned static-analysis accuracy (the technical moat)

Everyone else's "what will this affect?" is either absent or LLM-guessed and therefore hallucination-prone. PlanMap's design rule is the anti-hallucination position no incumbent leads with: **a static code parser decides *what* is affected; the LLM only explains *why* in plain language.** This is a credibility stance competitors structurally under-invest in, because they are incentivized to showcase LLM magic, not constrain it. The catch, stated honestly: trustworthy cross-language static analysis is genuinely hard, and trust is asymmetric — a few confidently-wrong "this will break" calls destroy adoption faster than missing edges. Accuracy here is not given; it is *earned*, and it is the engineering moat.

### 3.5 The behavioral annotation moat (the compounding asset)

The 2026 "AI agents stack" thesis holds that the model, harness, and UI layers are *rented* while the context, schema, and verification layers are *owned* [48]. PlanMap's `.planmap` store — a plain, git-committed, inspectable data layer of plans + rationale — is an owned layer. But plain JSON in git is anti-lock-in by design: great for adoption and trust, weak for defensibility. So the moat is **behavioral, not technical**: it is the accumulated, *reused* annotations — the *why* that dies in chat and that no git log or codebase scan can reconstruct. Lock-in is real only if annotations accumulate faster than they rot and teams reuse them (in drift checks, onboarding, audits) often enough to feel loss on leaving. That is a metric to instrument from day one, not a claim to assume.

**Net moat:** `(earned impact-analysis accuracy) × (drift-against-approved-intent, stitched cross-layer) × (neutral, local-first positioning)`, compounded by accumulated, reused annotation data. Each part alone is copyable; the integrated, freshness-by-construction loop is the defensible whole.

---

## 4. What PlanMap IS and IS NOT

| PlanMap **IS** | PlanMap **IS NOT** |
|---|---|
| A planning + governance + comprehension layer **one level above** coding agents | A coding agent — it never writes code itself |
| A decider of *what the code should be*, handing scoped instructions to the user's agent | A code editor or an IDE fork |
| A self-populating map derived from real code, data, and cloud | A hand-maintained catalog (CMDB / Backstage-style) — the failure mode it must never become |
| An intent-vs-reality drift engine anchored to approved plan nodes | A pure visualization / diagram tool — a pretty graph is not a business |
| Agent/IDE-agnostic, local-first, BYO-key | A model host or a token-metered service |
| Data-as-truth: one `.planmap` store projected to **both** a 2D graph **and** auto-generated markdown | A chat transcript where the *why* evaporates |

The distinction is load-bearing: comprehension tools *explain* software (DeepWiki's turf — free, funded, read-only). PlanMap *decides* software and then *verifies* it. That is the whole defense against every comprehension tool, and the reason it must always tie visuals to an action loop (approve → analyze impact → detect drift → dispatch agent), never a standalone map.

---

## 5. The Four Pillars

**1. Plan Graph — the intended architecture, editable and zoomable.** AI drafts it; the human owns it (*AI drafts, human edits, human wins*). Two zoom levels: **Constellation** (the whole system, where a node is a feature) and **Feature Space** (inside one feature, where a node is a step). Three **Lenses** — Business, Backend, Security — change what nodes *mean* at either altitude without changing which feature or altitude you are in. A node's meaning is `zoom level × active lens`. This is how a massive prompt ("build a food-ordering app") stays readable: breadth at the top, depth inside, never everything at once.

**2. Impact Analysis — the hero.** When a node is edited, PlanMap shows what breaks, why, its dependencies, the risk (flagging anything touching auth, payments, user data, migrations), and its confidence — with uncertainty *always visible*. The critical rule: **a static code parser decides *what* is affected; the LLM only explains *why* in plain language.** LLMs hallucinate dependencies; parsers do not. Confidently-wrong impact analysis is worse than no tool, because the developer acts on it — so accuracy beats coverage, and "unsure" beats a guess.

**3. Evolution Graph — what actually exists.** Derived by *reading real code and infra*, not chat history. Every node stores the location of its code; when that code is removed, errors, or diverges from the approved intent, the node is flagged **drifted** or **error**. Drift is always measured against an explicitly **approved** plan node, and the stored annotation preserves the *why*. This pillar is the intent-vs-reality reconciliation made concrete — one drifted `remember me` node, with its 30-day rationale still intact, is the entire thesis rendered as a single object.

**4. Learn/Guide mode — a pedagogical view of the auto-populated map.** Same data, new view plus an entitlement. It presents the live map business-first, with progressive disclosure and guided tours of the real production path, surfacing the *why*. Unlike CodeSee's hand-authored tours — which rotted and never attached to a workflow — Learn/Guide mode is generated from the live map and re-verified by drift, so it *cannot go stale*. It is the answer to §2.4: a guide to real production that newcomers can trust because construction keeps it fresh.

**Beyond the four pillars — the north-star horizon (roadmap, not now).** The same grounded, executable map extends outward *after* M1: Slack/email ingested as *intent signals* that feed **proactive planning** (PlanMap drafts plans from where work is decided); a non-technical **Stakeholder view** (Learn/Guide mode for sales, PM, and execs — "explain the product to a client"); and the **"company brain"** framing — YC named "Company Brain" an official Summer 2026 RFS, and its ask ("structure fragmented knowledge, keep it current, turn it into an executable skills file for AI") describes PlanMap's DNA. What makes PlanMap's brain defensible where horizontal RAG-over-docs brains (Glean, Microsoft 365 Copilot, Dust) are a bloodbath is that it is grounded in *verifiable system reality* and is *executable* — comms and non-technical views are grounded read-outs on the verified map, never a co-equal source of truth. The discipline is absolute: this is the north star, **not** Milestone 1.

---

## 6. Why Now

Four forces make the window open now, and none of them was open two years ago.

1. **The pain is acute and quantified.** It moved from anecdote ("AI code feels sloppy") to primary evidence in 2025: DORA's instability paradox and low-trust findings [9][10][11], and GitClear's 211M-line erosion data [7][8]. Buyers can now *see* the problem in their own delivery metrics.

2. **The methodology has social proof.** Spec-driven development crystallized as a named movement in 2025 — Sean Grove's "The New Code," GitHub's **Spec Kit** (open-sourced Sept 2025, ~90k–111k stars within ~9 months, 30+ agent integrations) [12][14], AWS **Kiro** (spec-first IDE, GA Nov 2025) [18][19], OpenSpec [22], and Tessl's $125M "spec-as-source" bet [40][41]. PlanMap's "approve the plan, keep intent as truth" premise is now a validated category, not a pitch it has to invent.

3. **The tooling is still immature and markdown-bound.** Every shipping SDD tool today is markdown-file-based [13][22] and every native plan mode is ephemeral chat [29][33]. None does static-analysis-grounded impact analysis or plan-anchored, cross-layer drift. The whitespace is real *right now* — but it is a time-to-market window, not a permanent one (a giant could bolt a graph + impact view onto Spec Kit or Kiro in a quarter or two).

4. **The cautionary tale already played out.** CodeSee — codebase maps and hand-authored "tours," ~$10M seed — wound down in Feb 2024 and its assets went to GitKraken [43][44][45]. The lesson is baked into PlanMap's thesis: **a beautiful graph is not a business.** Auto-population + an action loop (impact + drift + agent handoff) is exactly the correction. Meanwhile, funding gravity is enormous but concentrated entirely in code *generation* — Cursor at a $29.3B valuation and ~$2B ARR [27][28], Claude Code at a ~$2.5B run-rate [32] — leaving the thin, cheap, neutral *governance* layer above them uncontested. That is both a survival advantage (nobody is defending this ground) and a fundraising handicap (there is no analyst budget line for it yet), and we should hold both truths at once.

The honest bottom line: PlanMap is a bet that the reconciliation of intent against reality — stitched across layers, kept fresh by construction, and made trustworthy by static-analysis accuracy — is a real, defensible product that the generation gold rush has left wide open. The untested core assumption remains whether an editable graph genuinely beats chat + markdown for real developers. We lead with the impact-analysis and drift value so the product earns its keep even for users who barely touch the graph, and we instrument whether teams *keep and reuse* annotations — because that single metric is the truest signal that the moat is real.
