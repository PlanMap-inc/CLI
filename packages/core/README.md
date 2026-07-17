# @planmap/core

The PlanMap **engine**. Pure TypeScript, **zero I/O dependencies** (no filesystem, network, database, DOM, or editor). Everything that decides _what the code should be_, _what a change breaks_, and _whether reality has drifted from approved intent_ lives here. Surfaces (`apps/cli`, `apps/web`, the VS Code extension) are thin transports over this package.

## What it contains

- **`model/`** — the domain model: `Node`, `Edge`, `LinkedCode`, `Drift`, and the canonical enums, all as `zod` schemas (validators + types from one source of truth).
- **`store/`, `connector/`, `llm/`** — the three seam interfaces the engine depends on (implemented by `@planmap/db`, `@planmap/connectors`, and LLM providers).
- **`depgraph/`, `automap/`, `impact/`, `drift/`, `project/`, `handoff/`** — the analysis engine.
- **`entitlements/`** — per-edition feature flags.

## Non-negotiable rules

- The **parser decides WHAT** (impact/drift facts); the **LLM only explains WHY**. Same input ⇒ same result every run.
- **Uncertainty is always visible**: every edge/finding carries `confidence: "certain" | "inferred"`.
- No I/O in this package — it reaches the world only through the seam interfaces.

## Usage

```ts
import { NodeSchema, type Node } from '@planmap/core';

const node: Node = NodeSchema.parse(rawJson);
```
