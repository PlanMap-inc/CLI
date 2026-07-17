import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapRepo, type GraphSnapshot } from '@planmap/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { handleApi, type ApiContext } from './api';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', 'examples', 'sample-org');

describe('web API — same engine as the CLI, over HTTP shapes', () => {
  let ctx: ApiContext;

  beforeEach(async () => {
    const storeRoot = await mkdtemp(join(tmpdir(), 'planmap-web-'));
    ctx = { repoRoot, storeRoot };
    await mapRepo(repoRoot, storeRoot);
  });

  afterEach(async () => {
    await rm(ctx.storeRoot, { recursive: true, force: true });
  });

  async function verifyTokenId(): Promise<string> {
    const res = await handleApi('GET', '/api/graph', ctx);
    const { nodes } = res.body as GraphSnapshot;
    const node = nodes.find((n) => n.linked_code.some((l) => l.symbol === 'verifyToken'));
    if (!node) throw new Error('verifyToken node missing');
    return node.id;
  }

  it('GET /api/graph returns the auto-mapped nodes and edges', async () => {
    const res = await handleApi('GET', '/api/graph', ctx);
    expect(res.status).toBe(200);
    const graph = res.body as GraphSnapshot;
    expect(graph.nodes.length).toBeGreaterThan(5);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('GET /api/impact/:id names the right dependents (the sample-org oracle)', async () => {
    const id = await verifyTokenId();
    const res = await handleApi('GET', `/api/impact/${encodeURIComponent(id)}`, ctx);
    expect(res.status).toBe(200);
    const impact = res.body as { affected: { path: string }[] };
    const files = impact.affected.map((a) => a.path);
    expect(files).toContain('src/auth/login.ts');
    expect(files).toContain('src/checkout/checkout.ts');
    expect(files).not.toContain('src/auth/reset.ts');
    expect(files).not.toContain('src/cart/cart.ts');
  });

  it('POST /api/approve/:id sets the drift baseline', async () => {
    const id = await verifyTokenId();
    const res = await handleApi('POST', `/api/approve/${encodeURIComponent(id)}`, ctx);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it('GET /api/drift reports verified/drifted/errored buckets', async () => {
    const res = await handleApi('GET', '/api/drift', ctx);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('verified');
    expect(res.body).toHaveProperty('drifted');
    expect(res.body).toHaveProperty('errored');
  });

  it('GET /api/handoff/:id emits a scoped instruction for the agent', async () => {
    const id = await verifyTokenId();
    const res = await handleApi('GET', `/api/handoff/${encodeURIComponent(id)}`, ctx);
    expect(res.status).toBe(200);
    const { instruction } = res.body as { instruction: string };
    expect(instruction).toContain('# Task:');
    expect(instruction).toContain('src/auth/jwt.ts');
  });

  it('GET /api/projection returns the dual-view markdown', async () => {
    const res = await handleApi('GET', '/api/projection', ctx);
    expect(res.status).toBe(200);
    const { markdown } = res.body as { markdown: string };
    expect(markdown).toContain('# PlanMap');
    expect(markdown).toContain('verifyToken');
  });

  it('404s an unknown route', async () => {
    const res = await handleApi('GET', '/api/nope', ctx);
    expect(res.status).toBe(404);
  });

  it('404s impact for a node that does not exist', async () => {
    const res = await handleApi('GET', '/api/impact/does-not-exist', ctx);
    expect(res.status).toBe(404);
  });
});
