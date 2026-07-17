import type { IncomingMessage, ServerResponse } from 'node:http';

import { loadGraph, mapRepo } from '@planmap/engine';

import { handleApi, type ApiContext } from './api';

let mapped: Promise<void> | null = null;

/** Cold start: if the store is empty, auto-map the repo once (A8 — opens populated). */
async function ensureMapped(ctx: ApiContext): Promise<void> {
  const graph = await loadGraph(ctx.storeRoot);
  if (graph.nodes.length === 0) await mapRepo(ctx.repoRoot, ctx.storeRoot);
}

/**
 * Connect-style bridge from Node's HTTP objects to the pure `handleApi`. Kept out of
 * the Vite config so it loads through Vite's SSR runner, which transpiles the TS and
 * runs the engine (and ts-morph) as real Node modules rather than bundling them.
 */
export async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ApiContext,
): Promise<void> {
  if (!mapped) mapped = ensureMapped(ctx);
  await mapped;

  const path = (req.url ?? '').split('?')[0] ?? '';
  const { status, body } = await handleApi(req.method ?? 'GET', path, ctx);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}
