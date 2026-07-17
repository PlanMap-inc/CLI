# PlanMap

**The self-populating map of how your software actually works — across code, data, and cloud — that catches when reality drifts from what you approved, and lets AI agents act on it.**

PlanMap is a planning + governance + comprehension layer that sits **one layer above** coding agents (Claude Code, Copilot, Cursor). It never writes code itself: it decides what the code _should_ be, hands a precise scoped instruction to whatever agent you already use, and then tracks intent-versus-reality afterward by reading the real system.

> **Status: Milestone 1 built (Solo edition).** The engine, the TypeScript/JavaScript connector, the local `.planmap` store, and two surfaces — a **CLI** and a **local-first web app** — are implemented and tested (green on Linux, Windows, and macOS). Point it at a repo and it auto-maps → shows parser-grounded impact → catches drift. The planning-phase documents and market research remain below.

---

## The four pillars

1. **Plan Graph** — the intended architecture, zoomable (Constellation → Feature Space; Business / Backend / Security / Frontend lenses). AI drafts, human edits, human wins.
2. **Impact Analysis** (the hero) — edit a node, see what breaks and why. A static parser (ts-morph) decides _what_ is affected; the LLM only explains _why_. Uncertainty is always visible.
3. **Evolution Graph + Drift** — what actually exists, read from real code/infra; nodes flag `drifted`/`error` when code diverges from _approved_ intent, and the annotation preserves the _why_.
4. **Learn/Guide mode** — a pedagogical view of the same live map that cannot rot, because drift re-verifies it.

## One engine, three editions

|       | **Solo** (free)                         | **Team**                     | **Org / Enterprise**                        |
| ----- | --------------------------------------- | ---------------------------- | ------------------------------------------- |
| Store | Local-first (SQLite/JSON in `.planmap`) | Hosted Postgres or self-host | Hosted or VPC/on-prem (Bedrock in your AWS) |
| Scope | Your own repo                           | A product = several repos    | The whole estate (code + DB + cloud + CI)   |
| Price | $0 (BYO LLM key, never metered)         | ~$19/seat/mo (directional)   | Custom                                      |

Built platform-ready from day one via a **storage adapter** (Local ⇄ Cloud, one schema), a pluggable **connector interface**, and tier **entitlements** — shipped **Solo-first, bottom-up**.

## Quickstart

Prerequisites: Node ≥ 22 and pnpm (this repo pins pnpm 11 via `packageManager`).

```bash
pnpm install

# Web app — opens on the bundled example org, auto-mapped on first load:
pnpm --filter @planmap/web dev          # then open http://localhost:5173

# CLI — the same engine, headless (run inside any TS/JS repo):
pnpm --filter @planmap/cli exec planmap map        # auto-populate the .planmap graph
pnpm --filter @planmap/cli exec planmap impact <nodeId>   # what a change affects, and why
pnpm --filter @planmap/cli exec planmap drift             # CI-friendly: non-zero on drift
```

Everything runs locally and offline; the LLM is BYO-key and only ever narrates the
_why_ of an impact/drift finding — it never decides the _what_, and tokens are never metered.

## Milestone 1 (frozen scope)

Point PlanMap at one TypeScript/JavaScript repo → it auto-builds an accurate map → edit a node → get correct, parser-grounded impact → catch a real drift. Shipped as the Solo edition, local-first. Everything larger (org-wide estate, Slack/email intent signals, proactive planning, the "company brain") is **north-star / later milestones**, deliberately not in M1.

---

## Start here

The planning phase lives in [`planning-phase/`](./planning-phase/). Begin with the index:

- **[planning-phase/00-README.md](./planning-phase/00-README.md)** — executive summary + table of contents
- [01 — Vision & Thesis](./planning-phase/01-vision-and-thesis.md)
- [02 — Market & Competitive Landscape](./planning-phase/02-market-and-competition.md)
- [03 — Product, Editions & GTM](./planning-phase/03-product-editions-and-gtm.md)
- [04 — Architecture](./planning-phase/04-architecture.md)
- [05 — Data Model & Graph](./planning-phase/05-data-model-and-graph.md)
- [06 — Roadmap & Milestones](./planning-phase/06-roadmap-and-milestones.md)
- [07 — Risks & Open Questions](./planning-phase/07-risks-and-open-questions.md)
- Research inputs: [`planning-phase/research/`](./planning-phase/research/) (three cited market-research reports)

**Milestone-1 implementation specs:** the engine spec
[`docs/superpowers/specs/2026-07-17-planmap-design.md`](./docs/superpowers/specs/2026-07-17-planmap-design.md)
and the web UI spec
[`docs/superpowers/specs/2026-07-17-m1-web-ui-design.md`](./docs/superpowers/specs/2026-07-17-m1-web-ui-design.md).

## Repository layout

```
packages/
  core         the engine — pure TS, zero I/O: model, impact, drift, projection, handoff
  connectors   language analysis (ts-morph) → the language-agnostic RepoStructure
  db           the local-first .planmap store + versioned migrations
  engine       the orchestration facade over core + connectors + db (one brain, many surfaces)
  ui           presentation-only React components (view-model in, callbacks out)
apps/
  cli          the headless, CI-scriptable surface
  web          the local-first web app (Vite SPA + a tiny local API over the engine)
examples/sample-org   a fixture repo with a known dependency oracle
planning-phase/       vision, market research, architecture, roadmap
docs/                 specs + design reference
```

---

## License

Apache-2.0 — see [LICENSE](./LICENSE). Copyright 2026 PlanMap authors.

---

_This is a living plan. The same discipline PlanMap is built around — keep the plan honest, update it when reality changes — applies to this repository too._
