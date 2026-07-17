# Contributing to PlanMap

Thanks for helping build PlanMap. This guide gets you productive fast and keeps the codebase consistent as the team grows.

## Prerequisites

- **Node.js >= 22** (Node 24 LTS recommended). Use any manager — nvm (`.nvmrc` is present), Volta (pinned in `package.json`), fnm, or a direct install.
- **pnpm** — pinned via the `packageManager` field in `package.json`. The simplest setup is `corepack enable` (ships with Node), which provisions the correct pnpm automatically.

## Getting started

```bash
git clone https://github.com/Adityagarg2712/PlanMap.git
cd PlanMap
corepack enable        # provisions the pinned pnpm version
pnpm install
pnpm build             # build all packages (Turborepo)
pnpm test              # run all tests (Vitest)
```

Everything is cross-platform — this works identically on Linux, macOS, and Windows (CI verifies all three).

## Repository layout

Monorepo (pnpm workspaces + Turborepo). Full rules in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

- `packages/core` — the engine. **Pure TypeScript, zero I/O deps.** All business logic lives here.
- `packages/db` — the storage adapter (`LocalStore` now; `CloudStore` later).
- `packages/connectors` — pluggable connectors (git/TS today; DB/cloud/CI later).
- `packages/ui` — framework-agnostic React (React Flow) renderer. No domain logic.
- `apps/cli`, `apps/web` — thin surfaces over `@planmap/core`.
- `examples/sample-org` — a synthetic fixture the accuracy tests run against.

## The one rule you must not break: core-first

**No domain logic in `apps/*` or `packages/ui`.** Surfaces only render, marshal events, and transport. The same engine must give identical answers via CLI, web, and CI — trust dies on the first discrepancy. A lint boundary enforces this.

## Dev loop

- `pnpm dev` — watch mode across packages.
- `pnpm --filter @planmap/core test` — test a single package.
- `pnpm lint` · `pnpm typecheck` · `pnpm format` — quality gates (also run in CI).

## Commits & PRs

- **Conventional commits:** `feat(scope): …`, `fix(scope): …`, `chore:`, `docs:`, `test:`, `ci:`.
- Keep commits **atomic** — one logical change each.
- Every change ships with tests (TDD encouraged). CI must be green — typecheck, lint, format, test, build — on Linux, Windows, and macOS.
- Keep code **OS-agnostic**: use `node:path` / `node:fs` / `node:os`; never hardcode path separators or shell out to OS-specific commands.

## Testing philosophy

Vitest. Engine logic is unit-tested against `examples/sample-org` (a fixture with a _known_ dependency structure), so impact-analysis accuracy and drift detection are measured on every commit. **Say "unsure", never guess** — a confidently-wrong result is a test failure, not an acceptable approximation.
