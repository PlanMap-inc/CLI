# PlanMap — Design Reference (initial UX ideation)

These self-contained HTML mockups are the **initial ideation-phase UX** for PlanMap — clickable prototypes with **hardcoded sample data**. Open them in a browser.

- **`planmap-v5-mockup.html` — canonical.** The agreed visual/interaction baseline.
- `planmap-v3-mockup.html`, `planmap-v2-mockup.html` — earlier iterations, kept for history.

## What v5 demonstrates (the UX baseline we're keeping)

- **Icon rail:** PlanMap · Evolution Graph · Chat.
- **Plan Graph:** Constellation (feature nodes) ↔ Feature Space (step nodes) via click-to-zoom; **Business / Backend / Security lens** switch; pan/zoom canvas; add / edit / delete / connect nodes; an **Impact** side-panel (affected files, *why*, risk, confidence).
- **Evolution Graph:** collapsible tree, tag filter, node detail with **drift / error callouts** and the annotation (the *why*).
- **Visual language:** dark theme; Space Grotesk / Inter / JetBrains Mono; per-feature and per-lens accent colors; a status legend (`intended` / `approved` / `implemented` / `drifted` / `error`).

## What Milestone 1 builds *on top of* this (the real product under the shell)

v5 is a **shell with hardcoded data**. M1 keeps the interaction model and replaces the fake data with the real engine (see [`../superpowers/specs/2026-07-17-planmap-design.md`](../superpowers/specs/2026-07-17-planmap-design.md)):

| v5 mockup (today) | Milestone 1 (real) |
|---|---|
| Hardcoded feature/step nodes | **Auto-map** from real TS/JS code (git + ts-morph connector) — zero manual entry |
| Canned "impact" strings | **Parser-grounded Impact Analysis** — ts-morph decides *what*; LLM only narrates *why*; confidence always visible |
| Static "drifted" badge | **Drift** computed from linked-code hashes vs. an *approved* plan node, annotation preserved |
| Single view | **Dual-view** — the same `.planmap` data also projects to committed markdown |
| Browser demo only | **CLI parity** + storage / connector / LLM seams (`StorageAdapter`, `Connector`, `LLMProvider`) |

## Roadmap (explicitly **not** M1)

Refined and expanded UX, the non-technical **Stakeholder view**, proactive-planning surfaces fed by Slack/email intent signals, and the org-wide / "company brain" views — all north-star, layered on the same renderer in later milestones.
