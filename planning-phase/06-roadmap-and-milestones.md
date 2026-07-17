# PlanMap — Roadmap & Milestones

> **Status:** planning-phase document 06 of the PlanMap set. Consistent with the canonical brief (2026-07-17).
> **Citation notation:** `[R1:n]` = source *n* in Market Research Report #1 (SDD / AI plan-mode landscape); `[R2:n]` = source *n* in Report #2 (IDP / org-map / config-graph / agent-platform landscape). A section reference like `[R1:§5]` points to a numbered *section* of the report (not a numbered source), used where a claim is supported by a section's discussion rather than a single source. Figures are used only as they appear in those reports, with their uncertainty flags preserved.

---

## 0. The shape of the roadmap in one paragraph

PlanMap ships as **one engine in three editions** — Solo, Team, Org — released in that order. The engine is built **platform-ready from day one** (storage adapter, connector interface, entitlements) but **shipped Solo-first, local-first, free**, because every piece of evidence says the org-wide living map dies of staleness before it delivers value (ServiceNow CMDB's chronic "stale, untrustworthy data" [R2:10]; Backstage catalogs "never completed" [R2:8]; ~half of platform teams disbanded within ~18 months, *directional/unverified* [R2:20]; CodeSee's outright shutdown [R1:44][R2:22]). The three milestones map exactly to the three editions. M1 proves the **auto-map + Impact Analysis + Drift** loop on a single developer's own repo; M2 proves it **shared across a team's repos with governance in CI**; M3 proves the **cross-layer drift stitch across the whole estate, executable by agents**. The non-negotiable rule threaded through all three: the map **auto-populates from ground truth and never becomes a hand-maintained catalog**.

---

## 1. The milestone sequence: M1 → M2 → M3

This sequence is locked. Each milestone is a complete, shippable edition — not a phase of a monolith. M2 is not started until M1's core loop is validated with real Solo users (see §5), because breadth-first is precisely the failure mode that killed the predecessors.

### M1 — Solo edition (local-first): the auto-map + Impact + Drift engine

**Scope (per locked decisions):** the auto-map + Impact Analysis + Drift engine + storage adapter + git/TypeScript connector + web UI + CLI, shipped first as the **Solo edition**, running locally (SQLite/JSON in a `.planmap` store), no account, BYO LLM key, connectors = git/code (TypeScript-JS first).

**What it proves:** the untested core assumption — that a **static-analysis-grounded Impact Analysis + plan-anchored Drift loop** is worth more to a real developer than chat + markdown specs. Report #1 names this "the #1 risk": every shipping SDD tool today (Spec Kit, OpenSpec, Kiro) is markdown-file-based [R1:13][R1:22], native plan modes are chat/text [R1:29][R1:33], and developers have rejected heavier visual layers before (CodeSee did not convert [R1:44]). M1 exists to find out whether the graph earns its surface area, on one developer's own code, at zero cost and zero procurement.

**Acceptance criteria (concrete):**
| # | Criterion | Verifiable pass condition |
|---|---|---|
| A1 | Auto-map on a real TS/JS repo | Point at any TypeScript/JavaScript repo; a Constellation (feature nodes) + Feature Space (step nodes) `.planmap` store is produced with **no manual YAML entry**. |
| A2 | Impact Analysis is parser-grounded | Editing a Node lists affected nodes/files/functions/endpoints from **static analysis (ts-morph)**, with the LLM producing only the *why* prose. Every claim carries a confidence flag; "unsure" is shown rather than guessed. |
| A3 | Drift catches a real out-of-band change | A code change made outside PlanMap against an **approved** plan Node flips that Node to `drifted`/`error`, preserving the stored annotation (the *why*). |
| A4 | Dual-view holds | The `.planmap` store projects to **both** a 2D graph (React Flow / @xyflow/react) **and** auto-generated markdown that produces clean git diffs. |
| A5 | Two surfaces, one engine | Identical results via **web UI** and **CLI**; no surface-specific logic lives outside `packages/core`. |
| A6 | Scoped agent handoff | PlanMap emits a precise, scoped instruction for the user's own agent (Claude Code / Copilot / Cursor); it never writes code itself. |
| A7 | Runs cold, offline, keyless-until-LLM | Fresh clone + `.planmap` init works with no account and no network except the user's own BYO LLM key. |
| A8 | Ships with a working example | `examples/sample-org` opens to a populated, drift-annotated map on first run. |

### M2 — Team edition (hosted store + collaboration): the loop, shared and gated

**Scope (per locked decisions):** hosted central store (or self-host) + GitHub-org multi-repo + collaboration/approvals + **Drift-in-CI** + roles; connectors add GitHub-org, Postgres/DB schema, basic AWS, Jenkins; agent execution = dispatch an agent to open an **Impact-gated PR**, Drift re-verified.

**What it proves:** that the loop survives contact with a *team* — that the plan-approval gate becomes a real workflow (the "team lead / plan review" buyer [R1:§6]) and that Drift-in-CI is sticky enough to be a paid tier. It also proves the storage adapter swap works: **CloudStore (Postgres) with the identical schema** replaces LocalStore with no engine changes. The paid line sits behind team collaboration + Drift-in-CI + roles, deliberately, because a free tier that cannot convert is the other way CodeSee died [R1:44][R1:§6].

**Acceptance criteria (concrete):**
| # | Criterion | Verifiable pass condition |
|---|---|---|
| B1 | Storage adapter swap | Same schema, same UI, LocalStore → CloudStore (Postgres) with no core changes. |
| B2 | Cross-repo map + Impact | A "product = several repos" yields one map; Impact Analysis crosses repo boundaries. |
| B3 | Approval workflow + roles | Plans require explicit human approval; Drift is measured against the **approved** Node. |
| B4 | Drift-in-CI | A CI check fails a PR that drifts from an approved plan Node (the "GitHub Action" pattern OSS "Drift" already uses [R1:47]). |
| B5 | Impact-gated agent PR | PlanMap dispatches the team's agent to open a PR; Impact Analysis runs as the gate; Drift is re-verified post-merge. |
| B6 | First cross-layer connector | At least Postgres/DB schema drift is bound to a plan Node end-to-end. |

### M3 — Org edition (the org-wide executable living map): the cross-layer stitch

**Scope (per locked decisions):** cross-layer connectors (DB / AWS / Jenkins / Bedrock) + **agent-execution control plane** + governance/SSO/audit; hosted or VPC/on-prem for data residency (Bedrock in their AWS); full connector suite; the org-wide **cross-layer Drift stitch**, SSO/RBAC, audit logs, org policy gates.

**What it proves:** the actual moat — the **cross-layer intent-vs-reality Drift stitch**: binding code + DB schema + cloud + CI into **one** drift-checked, agent-executable graph. This is the whitespace no incumbent fully owns: Firefly is infra/IaC only [R2:9]; Port / Cortex are service-catalog only [R2:3][R2:25]; Multiplayer is architecture/APIs only [R2:23]; Sourcegraph is code-graph only [R2:17]. Report #2 is explicit that value and defensibility are *emergent at the org level* — and that the giants (Port's $100M Context Lake at $800M [R2:3], Atlassian's 150B-edge Teamwork Graph opened to agents [R2:18], GitHub Agent HQ [R2:21]) are racing for it now.

**Acceptance criteria (concrete):**
| # | Criterion | Verifiable pass condition |
|---|---|---|
| C1 | Cross-layer Drift stitch | A single change surfaces drift spanning **code + DB schema + cloud + CI** against one approved intent, in one graph. |
| C2 | Buy/borrow ingestion | Cloud/CI inventory comes from **existing sources** (GitHub API, CloudQuery/Steampipe, AWS Config, Jenkins API [R2:11][R2:12]) as inputs — PlanMap builds the drift-graph + execution brain, not the ingestion. |
| C3 | Agent-execution control plane | Org policy gates govern which agents may act on which nodes, with audit. |
| C4 | Data residency | VPC/on-prem deploy; **Bedrock (Claude-on-Bedrock) runs in the customer's AWS** [R2:15]; PlanMap never meters tokens. |
| C5 | Governance | SSO/RBAC + audit logs + org policy gates operational. |

**Learn/Guide mode** is layered *across* editions (same data, new view + entitlement), not a separate milestone: generated from the live map and re-verified by Drift so it cannot rot — unlike CodeSee's hand-authored tours [R1:44][R2:22].

---

## 2. M1 detailed build order

Core-first and dependency-ordered: nothing renders until the engine underneath it is trustworthy. This mirrors the spec's hard-won lesson — *Impact Analysis needs the dependency map, so the map comes first; if you are building lenses before Impact Analysis works, you have drifted.* Kept tight enough for a tiny team.

| Step | Build | Depends on | Proves / why here |
|---|---|---|---|
| **0** | **Hand-test (zero code).** Take 3–4 real architectural changes already made to a known repo; on paper, could Impact Analysis have listed everything each one affected, correctly, beforehand? | — | Whether the core engine is even possible. Make-or-break, before a line of product code. |
| **1** | **Core engine + data model.** `packages/core`: the `.planmap` schema (Node, Edge, status, origin, `linked_code[]` with hash + `last_verified`, annotation). No surface. | 0 | Data-as-truth. Everything projects from this; no surface-specific code in core. |
| **2** | **Storage adapter.** LocalStore (SQLite/JSON) behind the adapter interface used by M2's CloudStore. | 1 | The one-engine mechanism; built org-ready even though Solo only uses LocalStore. |
| **3** | **Connector interface + git/TypeScript connector.** Pluggable connector; ts-morph reads real TS/JS. Solo loads only git. | 1 | The single input source for M1; the interface is where M2/M3 register more. |
| **4** | **Auto-map (Constellation + Feature Space).** Derive feature/step nodes from the parsed code — the Evolution Graph of *what actually exists*, plus a drafted Plan Graph. **No manual entry.** | 2,3 | Freshness-by-construction; the anti-catalog wedge in action. |
| **5** | **Impact Analysis (the hero).** Static analysis decides *what* is affected (imports, call sites, symbol refs walked outward); the LLM only explains *why*. Confidence always visible. | 3,4 | The core value, and the sharpest defensible wedge [R1:§5]. Parsers don't hallucinate; LLMs do. |
| **6** | **Drift.** Re-hash `linked_code` ranges on save; mismatch against an **approved** Node → `drifted`/`error`, annotation preserved. | 4 | The differentiator: drift *against approved intent + stored why*, not generic rules [R1:§5]. |
| **7** | **Web UI (React Flow / @xyflow/react, 2D).** Constellation ↔ Feature Space Zoom; Business/Backend/Security Lenses; edit a Node → Impact Analysis → approve. | 5,6 | The visual on-ramp; 2D only (3D deferred to v2 unless users demand it). |
| **8** | **CLI.** Same engine headless: init, map, impact, drift, agent-handoff. | 5,6 | Terminal/CI-native workflows; validates one-engine/two-surface parity. |
| **9** | **Dual-view markdown projection.** `.planmap` → auto-generated markdown for clean git diffs, PR review, Spec Kit / OpenSpec interop. | 1 | Data-as-truth, dual-view; interoperate with the SDD format war rather than fight it. |
| **10** | **Scoped agent handoff.** Emit a precise scoped instruction to the user's installed agent. PlanMap never writes code. | 5 | The "one layer above coding agents" position. |
| **11** | **Solo edition packaging + entitlements.** Local-first, no account, BYO-key; entitlement flags gate Team/Org features off. | 2–10 | Ships the edition; entitlements are wired so M2/M3 unlock, not rebuild. |
| **12** | **Bundled `examples/sample-org`.** A repo that opens to a populated, drift-annotated map on first run. | 4–7 | Cold-start credibility; a demo that shows the loop in one flow. |

**Sequencing rule:** steps 0–6 are *the product*; 7–12 dress it for shipping. A demoable end-to-end loop exists at step 7 (edit Node → Impact → approve → agent handoff → Drift re-verify).

---

## 3. Platform-first architecture, bottom-up GTM

These pull in opposite directions on the surface — a platform wants breadth; a tiny team survives on a wedge. The resolution is **build org-ready, ship Solo-first**, and it is enforced by three architectural seams that cost little in M1 but make M2/M3 an *unlock* rather than a rewrite:

1. **Storage adapter** — LocalStore (SQLite/JSON) and CloudStore (Postgres) share an *identical schema*. Solo runs LocalStore; Team/Org flip to CloudStore with no engine change (acceptance B1).
2. **Connector interface** — Solo registers only the git/TypeScript connector; Team/Org register GitHub-org, DB, AWS, Jenkins, Bedrock against the same interface. The engine never knows which connectors are present.
3. **Entitlements** — one engine, tier flags. Cross-repo map, approvals, Drift-in-CI, the cross-layer stitch, SSO/audit, and the agent-execution control plane are gated by entitlement, not forked code. Core-first: every feature lands in `packages/core` first, then gets a surface.

**Why ship Solo first, not Org first.** Report #2's adversarial verdict is that the org-wide map is *both* a real, buyable, well-capitalized category *and* a graveyard for the naive version: a tiny team **cannot out-integrate $30M-funded ingestion specialists** (CloudQuery ~$34.5M total [R2:12]; Firefly ~$29.5M total [R2:9]), and top-down "boil-the-ocean map" sales is exactly where ~18-month platform failures happen (*directional/unverified* [R2:20]). The GTM is therefore **land bottom-up (Solo, developer-loved, free), expand top-down (Team then Org governance)** — the same path Port and Cortex actually walked [R2:§6]. Buyer progression: solo dev → team lead → platform/DevEx → enterprise. The architecture is built for the destination; the go-to-market starts at the door.

---

## 4. The hard rule: avoid the empty-catalog death

**Rule (non-negotiable): the map auto-populates from ground truth and re-refreshes by construction. PlanMap is NEVER a human-maintained catalog.** This is a product invariant, checked at every milestone gate, not an aspiration.

The evidence that hand-maintained maps die is overwhelming and it is the single most consistent signal across both reports:

| Predecessor | How it died / is dying | Source |
|---|---|---|
| ServiceNow CMDB | 20-year monument to hand-maintained maps decaying into "stale, inconsistent, untrustworthy data"; now retrofitting *Now Assist for CMDB* AI to keep it fresh. | [R2:10] |
| Backstage catalogs | Manual `catalog-info.yaml` "poses an adoption challenge even before launch"; **56% of adopters cite upgrades as the single biggest pain**; catalogs "never completed." | [R2:5][R2:8] |
| Platform teams | ~60–70% of platform-engineering initiatives fail to deliver impact; ~half disbanded/restructured within ~18 months (*directional/unverified*). | [R2:20] |
| CodeSee | Funded ($10M seed) "visualize your whole codebase" play; **shut down Feb 2024**, absorbed by GitKraken; visualization was a "nice to have" that never attached to a recurring, budget-owning workflow. | [R1:43][R1:44][R2:22] |

Every serious 2025–2026 incumbent now answers the population problem the same way — Cortex's *Magellan* AI catalog import [R2:25], OpsLevel's Catalog Engine [R2:22], Firefly's and Multiplayer's 100% auto-discovery [R2:9][R2:23]. **Freshness-by-construction is therefore the product, not a feature**, and it is what M1 must prove first.

How PlanMap enforces it, concretely:
- **Evolution Graph is derived by reading real code/infra**, never chat history or hand-authored YAML. Nodes store the location of their code; when it is removed, errors, or diverges from approved intent, the Node is flagged `drifted`/`error`.
- **Drift is the freshness watchdog.** A stale map is a *visible failure state* (a drifted Node), not silent rot — the opposite of the CMDB failure mode.
- **Buy/borrow ingestion, build the brain.** M3 leans on GitHub API, CloudQuery/Steampipe, AWS Config, Jenkins API as *inputs* [R2:11][R2:12]; PlanMap builds the drift-graph + agent-execution brain on top. Do not try to out-integrate funded ingestion specialists.
- **Learn/Guide mode is generated from the live map and re-verified by Drift**, so it cannot rot the way CodeSee's hand-authored tours did.

---

## 5. Success metrics & the key validation experiments

The metrics exist to answer one question early and cheaply: **is the core assumption true?** Report #1 is blunt that the untested assumption is the #1 risk and that the real signal of a moat is whether teams *keep and reuse annotations* [R1:§5][R1:§7]. Vanity metrics (installs, stars) are explicitly not the bar.

### 5.1 The three validation experiments (run during and after M1)

| # | Experiment | Question | Pass signal | Grounding |
|---|---|---|---|---|
| **E1** | **Graph vs. chat+markdown (A/B the core assumption)** | Does an editable, zoomable Plan Graph beat chat + markdown specs for real developers? | Developers **re-open the graph unprompted** on a 2nd and 3rd feature; measurable preference over a markdown-only arm. | The #1 risk; SDD today is overwhelmingly markdown [R1:13][R1:§2] |
| **E2** | **Annotation keep-and-reuse (the real moat signal)** | Do the *why* annotations accumulate faster than they rot, and get **reused** (in Drift review, onboarding, audits)? | Annotations survive across weeks and are surfaced/read again — not written once and abandoned. | The moat is behavioral, not technical [R1:§5][R1:§7] |
| **E3** | **Impact Analysis reduces rework (git churn)** | Does parser-grounded Impact Analysis change behavior — fewer reverts/rework? | Lower short-term churn on PlanMap-gated changes, measured via **git churn** in GitClear's methodology (baseline: churn rose 3.3%→5.7%; ~7.9% of new code revised within two weeks [R1:7][R1:8]). | Impact Analysis is the wedge; rework is the harm it targets [R1:§7] |

### 5.2 Ongoing success metrics (per edition)

| Metric | What it tells us | Bar | Edition |
|---|---|---|---|
| **Impact accuracy** — real dependencies caught vs. missed vs. **invented** | The single most important number; a few confidently-wrong "this will break" calls destroy trust (asymmetric) | Near-zero invented dependencies; "unsure" over guessing | M1+ |
| **Return usage** — graph re-opened unprompted on 2nd/3rd feature | Whether the graph earns its surface area (E1) | Positive and rising | M1+ |
| **Manual-edit rate** — how often humans author/edit Nodes | High = the canvas earns its keep; zero = they don't trust it or don't need it | Non-trivial and sustained | M1+ |
| **Drift catches** — real out-of-band divergences flagged | Each real catch proves the thesis (E2/E3) | Each catch is a proof point | M1+ |
| **Annotation reuse rate** (E2) | The behavioral moat forming | Rising reuse over time | M1+ |
| **Drift-in-CI adoption** — teams running the CI gate | Workflow stickiness; free→paid conversion signal | Teams keep the gate on | M2+ |
| **Approval-gate engagement** — plans actually approved before code | The plan-review workflow is real | Approvals precede agent execution | M2+ |
| **Cross-layer catches** — drift spanning code+schema+cloud+CI | The stitch (the moat) delivering at estate scale | Real multi-layer catches | M3 |

### 5.3 Keeping M1 shippable by a tiny team

- **Ruthless sequencing:** one language (TypeScript/JavaScript via ts-morph), two surfaces (web + CLI; VS Code deferred), one connector (git/code). Impact Analysis is the hero; the graph is the on-ramp; everything else waits.
- **Accuracy over coverage:** the credibility pitch ("we don't hallucinate dependencies") collapses on a few false positives. Say "unsure." This is an *earned* engineering moat, not a feature toggle.
- **Avoid two self-inflicted deaths:** never meter LLM tokens (BYO-key; turn "no LLM margin" into a trust selling point — the anti-pattern of Kiro's Aug 2025 credit-model backlash [R1:21]); and never let the free tier be un-convertible (put team collaboration + Drift-in-CI + governance behind paid, the CodeSee lesson [R1:44][R1:§6]).
- **Ship the value even to graph-skeptics:** Impact Analysis and Drift must deliver value for a user who barely touches the graph — so M1 survives even if E1 comes back lukewarm.

---

## 6. Milestone summary (at a glance)

| | M1 — Solo | M2 — Team | M3 — Org |
|---|---|---|---|
| **Edition** | Solo (free, local-first) | Team (~$19/seat/mo, directional) | Org/Enterprise (custom) |
| **Store** | LocalStore (SQLite/JSON, `.planmap`) | CloudStore (Postgres) or self-host | Hosted or VPC/on-prem (Bedrock in their AWS) |
| **Connectors** | git / TypeScript-JS | + GitHub-org, Postgres/DB, basic AWS, Jenkins | + full suite; Bedrock; buy/borrow ingestion |
| **Headline capability** | Auto-map + Impact + Drift on your own repo | Cross-repo map, approvals, Drift-in-CI, Impact-gated agent PR | Cross-layer Drift stitch + agent-execution control plane + governance |
| **Surfaces** | web UI + CLI | + collaboration/roles | + SSO/RBAC, audit, org policy gates |
| **What it proves** | The core loop beats chat+markdown | The loop survives a team + gates in CI | The cross-layer stitch is the moat, at estate scale |
| **Buyer** | Solo dev / indie / OSS | Team lead / senior eng | Platform/DevEx → enterprise |

Learn/Guide mode ships as a view + entitlement across all three, generated from the live map and re-verified by Drift.

---

## 7. Vision horizon (post-M3, roadmap lane)

**These are north-star / roadmap-horizon items, all sequenced strictly AFTER the frozen M1 (one repo: auto-map → Impact → Drift, Solo edition) and beyond M2 and M3.** None of them enters Milestone 1 — M1's scope stays exactly as locked in §1 and §2. They are recorded here so the architecture is built toward the destination while the build order stays ruthless; each is Team/Org-tier or later, gated behind the same one-engine/entitlements seams.

1. **Communication connectors (Slack / email)** — a Team/Org-tier capability. Comms are ingested as **intent signals only** — never a co-equal source of truth — so they never dissolve the code+schema+cloud+CI-grounded Drift moat. Not in M1.
2. **Proactive planning** — PlanMap watches where work is actually decided (Slack / email / issues) and **drafts** Plan Graph nodes / suggested builds for human approval, extending the prompt → plan → approve → execute pipeline; human approval always gates. A roadmap-horizon extension, never M1.
3. **Stakeholder view** — extends Learn/Guide mode for **non-technical teams** (sales, marketing, PM, execs): plain-language, Business-lens explanations of features / status / roadmap — "explain the product to a client." It is the same live map presented for non-engineers, re-verified by Drift so it cannot rot. A post-M3 view + entitlement, not M1.
4. **"Company brain" north-star** — the Org edition's ultimate form: an always-fresh, multi-source (code+schema+cloud+CI, with comms as intent signals) system-of-record that both technical and non-technical people query and that agents act on. It is differentiated from horizontal RAG-over-docs brains (Glean, Microsoft 365 Copilot, Dust, Notion, Sana) by being grounded in **verifiable system reality** and **executable**. YC named "Company Brain" an official Summer 2026 RFS (Tom Blomfield), and its framing — "structure fragmented knowledge, keep it current, turn it into an executable skills file for AI" — describes PlanMap's DNA. Pursue this as a **north-star narrative, not a near-term product**: comms and non-technical layers are grounded read-outs on the verified map, never a co-equal source of truth. Emphatically not M1.
