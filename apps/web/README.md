# @planmap/web

The local-first PlanMap web app: a Vite + React SPA over [`@planmap/ui`](../../packages/ui),
served with a tiny local API that reuses the exact [`@planmap/engine`](../../packages/engine)
wiring the CLI uses — so both surfaces answer identically.

## Run it

```bash
pnpm --filter @planmap/web dev     # http://localhost:5173
```

The dev server points at [`examples/sample-org`](../../examples/sample-org) by default and
cold-starts by auto-mapping it, so it opens to a populated map. Point it at your own repo:

```bash
PLANMAP_REPO=/path/to/your/repo pnpm --filter @planmap/web dev
```

Set `PLANMAP_STORE` to keep the `.planmap` store somewhere other than the repo root.

## The loop, in the browser

Constellation (features) → click a feature → Feature Space (its functions as steps) →
click a step → **Impact** (real affected files; parser-grounded, LLM narrates only the
_why_) → **Approve** (sets the drift baseline) → **Get agent handoff** (a scoped
instruction to paste into your own coding agent). The **Evolution** view is the read-only
tree of what actually exists, with drift/error nodes calling out how reality diverged.

## How it fits together

- `src/` — the SPA. `App.tsx` composes `@planmap/ui`; `adapter.ts` is the only module
  that maps engine types onto the UI view-model; `api-client.ts` talks to the local API.
- `server/` — `api.ts` is the whole API as one pure function over the engine (unit-tested);
  `handler.ts` bridges Node's HTTP objects to it. The Vite plugin in `vite.config.ts` loads
  the handler through Vite's SSR runner, so ts-morph runs as a real Node module.

No domain logic lives here — the engine is the single brain.
