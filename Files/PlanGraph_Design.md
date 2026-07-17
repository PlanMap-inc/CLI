# PlanMap — Plan Graph Design Specification

> **Scope of this document:** This specifies the **Plan Graph** — PlanMap's primary visual interface for understanding how a piece of software works. It is one of the two graph systems in the extension. The other, the **Project Evolution Graph** (the historical development record), is a separate feature and is *not* covered here.
>
> This document captures the design as worked out with Sambhav, including the two-level zoom model, the multi-lens system, and how a very large prompt is handled.

---

## 1. What the Plan Graph Is

When a developer's prompt is classified as **high blast radius** (a real feature or a whole application, not a small fix), PlanMap does not answer with code or a text plan. It generates a **Plan Graph**: a spatial, zoomable map of the software, where the developer can see the whole system, zoom into any single feature, and view any part through different technical lenses.

The Plan Graph exists so the developer **understands and approves how the software will work — at the level of abstraction they care about — before any code is written.**

**Core principle:** *Understand the software before seeing the code.* The graph shows business behaviour first; technical implementation is revealed progressively, on demand, through zoom and lenses.

---

## 2. The Two Zoom Levels

The single most important idea in this design: **the Plan Graph is not one graph. It is two altitudes of the same map, and each altitude shows a different kind of node.** This is what lets a massive prompt ("build a complete food ordering app") produce something readable instead of one giant tangled flow.

### Level 1 — The Constellation (whole-project view)

The top-down, zoomed-out view of the **entire project at once**.

- **What a node/cluster represents:** a whole **feature or workflow** — e.g. *Browse Restaurants*, *Register / Login*, *Cart*, *Checkout*, *Order Tracking*, *Ratings*.
- **What you see:** every feature of the project as a distinct, **color-coded** region. You are NOT looking at individual steps here — you are looking at the shape of the whole system, the way constellations group stars.
- **Why it exists:** it answers "how does the graph survive a huge prompt?" — a prompt like *"make me a complete food ordering application"* has enormous blast radius and many features. Instead of cramming all of it into one flow, PlanMap lays the features out as separate clustered regions you can take in at a glance.
- **How clusters are connected:** by **user journey** (arrows showing how a user moves feature-to-feature: browse → cart → checkout → tracking) — and, when the lens is switched, by **backend workflow** (how requests/data move between features at the system level). See Section 3: lenses apply here too.

### Level 2 — The Feature Space (zoom-in view)

Click a single feature at the Constellation level and the canvas **zooms into that region** — spatially, like flying down into one area of a map ("we zoom it into a space").

- **What a node represents:** a **meaningful step in that feature's workflow** — not a whole feature anymore.
- **Example (Login feature, Business lens):**
  `land on domain → home page → click Register/Login → enter email → enter password → complete reCAPTCHA → press Enter → dashboard opens`
- Each node is a real, understandable software event. This is the detailed, walkable flow of that one feature.

**Navigation metaphor to keep consistent:**
- **Zoom** = moving between altitudes (Constellation ↔ Feature Space). It is *spatial* — you fly down into a region and back out.

---

## 3. The Lens System

**Lenses are the second navigation axis, orthogonal to zoom.** Where zoom changes your *altitude*, a lens changes **what the nodes mean** — without changing which feature or which altitude you're at.

**Critical decision (locked):** lenses apply at **BOTH zoom levels** — the Constellation and the Feature Space — not only inside a feature.

### At the Constellation level
- **Business lens:** features connected by **user journey** (how a person flows through the product).
- **Backend lens:** the *same* features, re-connected by **how requests and data actually move between them** at the system level.
- (Security lens, later: highlights which features form trust boundaries / handle sensitive data.)

### At the Feature Space level (inside one feature, e.g. Login)
The same feature's flow, seen three ways:
- **Business lens** — user-facing steps:
  `land → home → click Register → email → password → reCAPTCHA → submit → dashboard`
- **Backend lens** — the same login as request execution through the code:
  `API → route → middleware → controller → service → DB → response`
- **Security lens** — the same login as trust boundaries:
  `credentials received → input validation → password hash verification → JWT issued → authorization → access granted`

**The key property:** it is the *same* feature and the *same* underlying data every time. The lens only changes how the request-through-the-system is portrayed. Switching lenses does **not** move you to a different feature and does **not** change your zoom altitude.

**Navigation metaphor to keep consistent:**
- **Lens** = staying at the same altitude but changing what the nodes *represent* (business steps vs. backend calls vs. security boundaries).

### The two axes together (mental model)

```
                 BUSINESS LENS        BACKEND LENS          SECURITY LENS
              ┌──────────────────┬──────────────────┬──────────────────┐
CONSTELLATION │ features linked  │ features linked  │ features as trust│
 (whole app)  │ by user journey  │ by data/req flow │ boundaries       │
              ├──────────────────┼──────────────────┼──────────────────┤
FEATURE SPACE │ user-facing      │ API→route→...→DB │ creds→validate→  │
 (one feature)│ steps of login   │ →response        │ hash→JWT→access  │
              └──────────────────┴──────────────────┴──────────────────┘
   ▲ ZOOM (spatial: fly between altitudes)      ◄─── LENS (reinterpret nodes) ───►
```

- **v1 ships Business + Security lenses.** Backend lens is described here because it's central to the concept, but it is a fast-follow, not necessarily a launch requirement. (This should be reconciled with the PRD; the Backend lens matters more to this design than the PRD currently implies — see Open Questions.)

---

## 4. How a Large Prompt Flows Through the System

Worked example, end to end, for the hardest case:

**Prompt:** *"Make me a complete food ordering application."*

1. **Triage** classifies this as very high blast radius → structured path → Plan Graph generation.
2. **Constellation generated.** PlanMap produces the whole-project map: every feature as a color-coded cluster (Browse Restaurants, Register/Login, Cart, Checkout, Payments, Order Tracking, Ratings…), connected by user journey under the default Business lens.
3. **Developer surveys the whole system** at a glance — sees every workflow and feature the app will contain, before a line of code exists.
4. **Developer clicks one feature** (e.g. *Register/Login*). The canvas **zooms into that Feature Space**, revealing the detailed business-logic flow of just that feature.
5. **Developer switches lens** inside the feature to inspect it as backend execution or as security boundaries — same feature, different portrayal.
6. **Developer reviews/edits/approves** at whichever level is relevant. Approved work proceeds to the coding agent (per the main pipeline).

This is the answer to the original design worry ("a huge prompt has too many features and too much business logic for one graph"): **the graph never tries to show everything at one altitude.** Breadth lives at the Constellation level; depth lives in each Feature Space; the developer moves between them by zooming.

---

## 5. What a Node Represents (summary table)

| Level | A node represents | Example |
|---|---|---|
| **Constellation** | A whole feature / workflow | "Checkout", "Register / Login" |
| **Feature Space — Business lens** | A user-facing step | "Enter password", "Complete reCAPTCHA" |
| **Feature Space — Backend lens** | A stage of request execution | "Middleware", "Controller", "DB query" |
| **Feature Space — Security lens** | A trust-boundary step | "Hash verification", "JWT issued" |

The rule of thumb: **a node's meaning is determined by (zoom level × active lens).** Same map, two altitudes, three lenses.

---

## 6. Relationship to the Rest of PlanMap

- **This is the "structured path" output.** The Plan Graph is what the structured path (from the main pipeline) produces for high-blast-radius prompts. Small/low-risk prompts (fast path) never generate a Plan Graph.
- **Approval + drift still apply.** Nodes in the Feature Space carry status (pending/approved/implemented/drifted) and link to code, exactly as in the core data model. Drift is shown in place on the relevant node.
- **This is NOT the Project Evolution Graph.** The Evolution Graph is a *separate* feature that records how the project was developed over time (a semantic history tree). The Plan Graph shows *how the software works*; the Evolution Graph shows *how the project got here*. Keep them mentally and architecturally distinct.

---

## 7. Open Questions / Not Yet Decided

- **Auto-layout at the Constellation level.** Laying out many color-coded feature clusters without overlap, with journey/data arrows between them, is a real rendering challenge (force-directed vs. structured layout). Not yet designed.
- **Zoom transition.** The "fly into a space" transition (Constellation → Feature Space) is described metaphorically; the actual interaction (animated zoom vs. drill-in/replace) isn't decided.
- **Backend lens in v1.** This design leans on the Backend lens more heavily than the current PRD (which ships Business + Security first). Decide whether Backend needs to be in v1 given how central it is to the "same graph, open the backend view" idea.
- **Editing at the Constellation level.** Can a developer add/remove/merge whole *features* at the top level, or is editing only meaningful inside a Feature Space? Not yet decided.
- **Cross-feature nodes.** Some steps (e.g. "send confirmation email") belong to multiple features. How these are represented across Feature Spaces isn't yet defined.

---

## 8. Terminology (use these names consistently)

- **Plan Graph** — the whole system described here.
- **Constellation** — the zoomed-out, whole-project view; nodes are features.
- **Feature Space** — the zoomed-in view of one feature; nodes are workflow steps.
- **Zoom** — moving between altitudes (spatial).
- **Lens** — reinterpreting nodes at the current altitude (Business / Backend / Security).
- **Project Evolution Graph** — the *separate* historical-record feature (not part of this doc).

---

*This document reflects the Plan Graph design as worked out so far and should be treated as a living draft. It supersedes earlier, muddier descriptions that conflated the whole-project view, the per-feature view, and the historical record into a single graph.*
