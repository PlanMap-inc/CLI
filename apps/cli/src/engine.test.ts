import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LocalStore } from '@planmap/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  approveNode,
  driftCheck,
  handoffForNode,
  impactForNode,
  mapRepo,
  projectMarkdown,
} from './engine';

const here = dirname(fileURLToPath(import.meta.url));
const sampleOrg = join(here, '..', '..', '..', 'examples', 'sample-org');
const NOW = '2026-01-01T00:00:00Z';

async function verifyTokenNodeId(storeRoot: string): Promise<string> {
  const store = await LocalStore.open(storeRoot);
  const node = (await store.queryNodes()).find((n) =>
    n.linked_code.some((l) => l.symbol === 'verifyToken'),
  );
  if (!node) throw new Error('verifyToken node was not auto-mapped');
  return node.id;
}

describe('M1 end-to-end: analyze -> automap -> store -> impact -> drift', () => {
  let store: string;

  beforeEach(async () => {
    store = await mkdtemp(join(tmpdir(), 'planmap-e2e-'));
  });

  afterEach(async () => {
    await rm(store, { recursive: true, force: true });
  });

  it('auto-maps the sample repo into a store with no manual entry', async () => {
    const result = await mapRepo(sampleOrg, store, NOW);
    expect(result.nodes).toBeGreaterThan(5);
    expect(result.edges).toBeGreaterThan(0);
    await expect(verifyTokenNodeId(store)).resolves.toBeTruthy();
  });

  it('names exactly the right dependents, parser-grounded, no LLM (T-IMPACT)', async () => {
    await mapRepo(sampleOrg, store, NOW);
    const id = await verifyTokenNodeId(store);
    const impact = await impactForNode(id, sampleOrg, store);
    const files = impact.affected.map((a) => a.path);
    expect(files).toContain('src/auth/login.ts');
    expect(files).toContain('src/checkout/checkout.ts');
    // reset.ts uses issueToken (not verifyToken); cart is unrelated — never invented
    expect(files).not.toContain('src/auth/reset.ts');
    expect(files).not.toContain('src/cart/cart.ts');
    expect(impact.riskFlags).toContain('auth');
    expect(impact.affected.every((a) => a.why === null)).toBe(true);
  });

  it('catches drift when approved code changes out of band (T-DRIFT)', async () => {
    await mapRepo(sampleOrg, store, NOW);
    const id = await verifyTokenNodeId(store);
    await approveNode(id, store);

    // Unchanged code verifies clean (no false positive).
    const clean = await driftCheck(sampleOrg, store, undefined, '2026-01-02T00:00:00Z');
    expect(clean.drifted).not.toContain(id);

    // Simulate an out-of-band change by staling the approved baseline hash.
    const store2 = await LocalStore.open(store);
    const node = await store2.getNode(id);
    if (!node) throw new Error('missing node');
    node.linked_code = node.linked_code.map((l) => ({ ...l, hash: 'STALE_BASELINE' }));
    await store2.putNode(node);

    const report = await driftCheck(sampleOrg, store, undefined, '2026-01-03T00:00:00Z');
    expect(report.drifted).toContain(id);
    const reopened = await LocalStore.open(store);
    expect((await reopened.getNode(id))?.status).toBe('drifted');
  });

  it('emits a scoped agent handoff and a markdown projection', async () => {
    await mapRepo(sampleOrg, store, NOW);
    const id = await verifyTokenNodeId(store);
    const handoff = await handoffForNode(id, sampleOrg, store);
    expect(handoff).toContain('# Task:');
    expect(handoff).toContain('src/auth/jwt.ts');
    expect(handoff).not.toContain('```');

    const markdown = await projectMarkdown(store);
    expect(markdown).toContain('# PlanMap');
    expect(markdown).toContain('verifyToken');
  });
});
