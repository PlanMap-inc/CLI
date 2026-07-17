# PlanMap — Product Specification

**v1.1** · Sambhav · VS Code extension · Pre-build

---

## 1. What It Is

A VS Code extension that sits **one layer above** coding agents (Claude Code, Copilot, Cursor).

It never writes code. It decides what the code should be, then hands a precise instruction to an agent that does.

**Not:** a coding agent · a code editor · a documentation tool · a model host.

---

## 2. Why It Exists

Architectural decisions today are made in chat. Chat is forgotten and reinterpreted. Over months this produces duplicated logic, inconsistency, and nobody remembering *why* anything is the way it is.

**PlanMap makes a graph the persistent source of truth for architecture.** The thinking happens in PlanMap. The agent executes.

> DeepWiki explains your repo as an article you read. PlanMap is the controls — see the system, click a node, change it, the change flows into code.

PlanMap does not *explain* software. It *decides* software. That distinction is the whole defense against every comprehension tool.

---

## 3. The Three Parts

| Part | Answers | Truth comes from |
|---|---|---|
| **Plan Graph** | How *should* this work? | Human intent (AI drafts, human edits) |
| **Impact Analysis** | If I change this, what breaks — and why? | The dependency map |
| **Evolution Graph** | What *actually* exists? | Reading the real code |

**Drift = Plan says X, Evolution says Y.**

---

## 4. Workflow

```
Prompt
  ↓
Triage: new project / feature / simple fix?
  ↓
Read existing code
  ↓
├─ SIMPLE FIX → locate exact code → generate exact prompt → agent executes
│               (no graph)
│
└─ PROJECT or FEATURE
      ↓
   Generate Plan Graph
      ↓
   Developer edits it (zoom, lenses, add/edit/delete nodes)
      ↓
   Edit triggers → IMPACT ANALYSIS
      ↓
   Developer approves
      ↓
   Generate precise prompt → agent implements
      ↓
   Evolution Graph re-derived from the written code
```

**Fast path:** "make the section bigger" → find the code → tell the agent exactly what to change. No thinking left to the agent.

**Escalation rule:** unclear = never guess. Escalate to the structured path. A confident wrong guess is worse than no tool.

---

## 5. Plan Graph

The intended architecture. AI drafts it; the human owns it.

### Two zoom levels

**Constellation** — whole project. A node = one feature (Login, Cart, Checkout). Color-coded. You see the system's shape, not its steps.

**Feature Space** — inside one feature. A node = one step.
`land → home → click Register → email → password → reCAPTCHA → submit → dashboard`

Click a feature at Constellation → fly down into its Feature Space.

**This is how big projects stay readable.** Never render everything at once. Breadth up top, depth inside.

### Three lenses

A lens changes what nodes *mean*. It never changes which feature you're in or your zoom level. **Lenses work at both levels.**

| | Constellation | Feature Space (Login) |
|---|---|---|
| **Business** | Features linked by user journey | `land → home → Register → email → password → submit → dashboard` |
| **Backend** | Features linked by data/request flow | `API → route → middleware → controller → service → DB → response` |
| **Security** | Features as trust boundaries | `credentials → validate → hash check → JWT → authorize → granted` |

**A node's meaning = zoom level × active lens.**

### Manual authoring (draw.io for architecture)

Non-negotiable. If the graph is the source of truth, the human must author it — not just approve AI output. **AI drafts, human edits, human wins.**

- Add / edit / delete nodes, at any level
- Draw and delete edges
- Drag, reparent, merge, reorder
- Annotate any node with *why*
- Undo/redo, multi-select, right-click menu, keyboard shortcuts

Manually-added nodes have no code behind them yet → status `intended`.

---

## 6. Impact Analysis ★

**The core. Everything else displays its output.**

Triggered when a developer edits a node, before approval. Shows:

1. **What's affected** — which nodes, files, functions, endpoints, tables
2. **Why** — the actual causal chain ("`login.ts` calls `verifyToken()`, whose signature changes")
3. **Dependencies** — what this needs, what needs this
4. **Risk** — flags anything touching auth, payments, user data, migrations
5. **Confidence** — certain vs. inferred. **Uncertainty is always visible.**

### How it works (v1 — must be concrete)

The dependency map comes from **static analysis of the real code**, not from the LLM:

- Parse imports, call sites, and symbol references (`executeWorkspaceSymbolProvider` + reference provider)
- Build a dependency graph: which symbols call which, which files import which
- A Plan node links to code ranges (§8) → changing a node = changing those ranges → walk the dependency graph outward to find dependents
- **The LLM's only job is explaining *why* in plain language.** It does not decide *what* is affected. Static analysis decides that.

This split is deliberate: **LLMs hallucinate dependencies; parsers don't.** The accuracy of this feature is the accuracy of the product.

**Top risk:** confidently-wrong impact analysis is worse than no tool, because the developer acts on it. Accuracy beats coverage. Say "unsure" instead of guessing.

---

## 7. Evolution Graph

**What actually exists**, derived by reading the code after the agent writes it. Not from prompt history.

- A vertically-growing tree of the project's real business workflow
- Every node stores the location of its code
- If that code is removed, errors, or diverges → node shows **drifted**

**Granularity:** feature → sub-feature → workflow-significant elements only. A form field or submit button qualifies *if the workflow depends on it*. Styling, layout divs, internal variables do not.

**Below feature level, collapsed by default.** A branch past ~15 nodes collapses to a summary node.

*Rationale for the cap: element-level modeling of an entire codebase is both unreadable and the DeepWiki-hard problem. Don't fight it.*

---

## 8. Data Model

JSON in `.planmap/`, committed to git. Durable, shareable, survives closing the editor. No server, no DB.

```json
{
  "id": "node_0143",
  "graph": "plan",              // plan | evolution
  "level": "feature_space",     // constellation | feature_space
  "type": "step",               // feature | step | element
  "title": "Rate-limit reset attempts",
  "intent": "Max 5 reset requests per email per hour.",
  "status": "implemented",      // intended | approved | implemented | drifted | error
  "origin": "ai_generated",     // ai_generated | manually_added | ai_edited_by_human
  "parent": "node_0140",
  "edges_out": ["node_0144"],
  "lens_tags": ["security", "backend"],
  "linked_code": [
    { "path": "src/auth/reset.ts", "range": [42, 78], "hash": "a91f..." }
  ],
  "annotation": "Per-email not per-IP — shared NAT in target market.",
  "created_at": "2026-07-01T10:12:00Z",
  "last_verified": "2026-07-03T09:00:00Z"
}
```

- `origin` — human-authored nodes are never silently overwritten by AI
- `linked_code[].hash` + `last_verified` → drift detection: re-hash on save, mismatch = drifted
- `annotation` → the *why*. The thing chat loses.

---

## 9. Tech

- **Shell:** VS Code extension. Sidebar for status; webview panel for the graph.
- **Split:** extension host (Node — files, git, parsing, LLM calls, hashing) ↔ webview (renders, emits events). Host thinks, webview draws.
- **Rendering:** React Flow. **2D.**
- **AI:** the developer's own key (`SecretStorage`) or their Copilot subscription. No hosted model.
- **Dependency map:** VS Code's symbol + reference providers. Static, not LLM.
- **Drift:** hash linked ranges, hook `onDidSaveTextDocument`.
- **Execution:** hand off to the installed agent.

### Why 2D, not 3D

- 3D doesn't add space, it adds occlusion. The screen is still 2D — nodes just hide behind nodes.
- PlanMap is a *precise review* tool. 3D distorts text, makes edges ambiguous, makes clicking fiddly.
- **Zoom already solves scale.** Constellation → Feature Space exists for exactly this. 3D solves it again, worse.
- Cost: Three.js + custom layout, hit detection, camera, 3D text vs. React Flow giving it free. Weeks on a renderer while impact analysis sits untouched.

Scale is handled by: more zoom levels if needed · collapse by default · lens filtering · focus mode (dim everything unconnected).

3D is a v2 answer *if* real users demand it.

---

## 10. Build Order

**Ordered so each phase feeds the next. Impact analysis needs the dependency map, so that comes first.**

| # | Build | Proves |
|---|---|---|
| **0** | **Hand-test.** Take 3–4 real architectural changes already made to Sentinel. On paper: could impact analysis have listed everything each one affected, correctly, beforehand? | Whether the core engine is possible. Make-or-break. Zero code. |
| **1** | Dependency map from static analysis (symbols, refs, imports). No UI — output to console. | The map is accurate. Everything downstream needs this. |
| **2** | Impact analysis on top of the map + LLM explaining *why*. Still no graph. | **The core value works.** |
| **3** | Static Plan Graph in a webview from hand-written JSON (React Flow). | The visualization works. |
| **4** | Manual authoring — add/edit/delete nodes + edges, drag, undo. Persist to `.planmap/`. | The human can own the architecture. |
| **5** | Wire 2 + 4: edit a node → impact analysis → approve. | The loop. **This is the product.** |
| **6** | Drift detection — hash linked code, diff on save, flag nodes. | The differentiator. |
| **7** | Zoom levels + lenses (Business, Security). | Navigation. |
| **8** | Triage classifier + fast-path scoped patching. | Small edits stay fast. |
| **9** | Auto hand-off to the agent. | No copy-paste. |
| **10** | Evolution Graph from written code. | The "what exists" half. |

**Phases 0–6 are the product. 7–10 are the vision.** If you're building lenses before impact analysis works, you've drifted.

**Time:** ~10–14 weeks part-time, ~5–7 weeks at 6–8 hrs/day. Demoable at Phase 5.

**Ramp-up:** 2–3 days TypeScript (it's JS + types; learn by hitting errors). Official "Your First Extension" walkthrough (`yo code`), get F5 debugging. Throwaway hello-graph webview before real code. Read the Webview guide (CSP gotchas). Next.js = React, graph panel = React — the new surface is small.

---

## 11. Rejected — Don't Re-propose

| | Why |
|---|---|
| **3D graph** | Occlusion ≠ space. Zoom already solves scale. 3–4× cost on the wrong problem. |
| **Element-level Evolution** | Unreadable at scale + it's the DeepWiki-hard problem. Capped at workflow-significant. |
| **"Understand how software works"** | DeepWiki's turf — free, funded, ~900K visits/mo. We *decide*, not explain. |
| **Codebase Terminal / repo comprehension** | Same. CodeSee (2019–24) proved the standalone version doesn't become a company. |
| **"Software Engineering OS"** | Every module is an entrenched category. Copilot Workspace tried it, sunset May 2025, rebuilt as a composable agent. |
| **Custom model router** | Commodity. LiteLLM ships one free; Kiro has one built in. |
| **Forking VS Code** | 90% of effort to reach table stakes. |
| **Building a coding agent** | Never compete on generation quality. Orchestrate instead. |

---

## 12. Risks

1. **★ Confidently-wrong impact analysis.** Developers act on it. Mitigation: static analysis decides *what*, LLM only explains *why*. Phase 0 tests this before anything else.
2. **Two truths.** Plan (intent) and code (reality) both change independently. Evolution-from-code is the mitigation, not a cure. This is the central engineering problem.
3. **Review fatigue.** A graph that fires on small edits is a tax. The fast/structured threshold is the hardest tuning problem — tune from real usage, not theory.
4. **Scope creep.** This spec keeps getting better *and heavier*. Heavy kills solo projects.
5. **Untested core assumption.** "An editable graph beats chat + markdown" has never been tested with one real user. Phase 0 is cheap. Do it.

---

## 13. Metrics

- **Return usage** — does a developer open the graph again, unprompted, on a 2nd and 3rd feature? *(the real signal)*
- **Impact accuracy** — real dependencies caught vs. missed vs. invented. *(the most important number)*
- **Manual-edit rate** — high = the canvas earns its keep. Zero = they don't trust it or don't need it.
- **Drift catches** — each real one proves the thesis.

---

## 14. Terms

**Plan Graph** — intended architecture · **Constellation** — whole project, node = feature · **Feature Space** — one feature, node = step · **Zoom** — change altitude · **Lens** — change what nodes mean · **Impact Analysis** — what a change breaks and why · **Evolution Graph** — what exists, from code · **Drift** — intent ≠ reality
