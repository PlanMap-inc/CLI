# PlanMap

**The self-populating map of how your software actually works — across code, data, and cloud — that catches when reality drifts from what you approved, and lets AI agents act on it.**

PlanMap is a planning + governance + comprehension layer that sits **one layer above** coding agents (Claude Code, Copilot, Cursor). It never writes code itself: it decides what the code _should_ be, hands a precise scoped instruction to whatever agent you already use, and then tracks intent-versus-reality afterward by reading the real system.

> **Status: Planning phase (pre-build).** This repository currently holds the planning-phase documents, the three market-research reports, and the Milestone-1 design spec. Product code is not yet scaffolded — that begins once the plan is reviewed.

---

## The four pillars

1. **Plan Graph** — the intended architecture, editable and zoomable (Constellation → Feature Space; Business/Backend/Security lenses). AI drafts, human edits, human wins.
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

**Milestone-1 implementation spec:** [`docs/superpowers/specs/2026-07-17-planmap-design.md`](./docs/superpowers/specs/2026-07-17-planmap-design.md)

## Planned repository layout (once code lands)

```
packages/{core, connectors, db, ui}   # the engine — core is pure TS, zero editor deps
apps/{api, web, cli, vscode}          # thin surfaces over core
examples/sample-org                   # fixture + impact/drift regression corpus
planning-phase/                       # these documents
docs/                                 # spec + generated docs
```

---

## License

Apache-2.0 — see [LICENSE](./LICENSE). Copyright 2026 PlanMap authors.

---

_This is a living plan. The same discipline PlanMap is built around — keep the plan honest, update it when reality changes — applies to this repository too._
