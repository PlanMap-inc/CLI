import { describe, expect, it } from 'vitest';

import { makeNode } from '../testing';

import { MemoryStore } from './memory-store';

describe('MemoryStore', () => {
  it('round-trips a node and returns a clone (the store owns its data)', async () => {
    const store = new MemoryStore();
    await store.putNode(makeNode({ id: 'n1', title: 'A' }));
    const got = await store.getNode('n1');
    expect(got?.title).toBe('A');
    if (got) got.title = 'mutated';
    const again = await store.getNode('n1');
    expect(again?.title).toBe('A'); // external mutation did not leak in
  });

  it('returns null for a missing node', async () => {
    const store = new MemoryStore();
    expect(await store.getNode('nope')).toBeNull();
  });

  it('filters queryNodes by graph / status / parent', async () => {
    const store = new MemoryStore();
    await store.putNode(
      makeNode({
        id: 'p',
        title: 'P',
        graph: 'plan',
        level: 'constellation',
        type: 'feature',
        status: 'approved',
        parent: null,
      }),
    );
    await store.putNode(
      makeNode({ id: 'c', title: 'C', graph: 'evolution', status: 'implemented', parent: 'p' }),
    );
    expect((await store.queryNodes({ graph: 'plan' })).map((n) => n.id)).toEqual(['p']);
    expect((await store.queryNodes({ status: 'implemented' })).map((n) => n.id)).toEqual(['c']);
    expect((await store.queryNodes({ parent: 'p' })).map((n) => n.id)).toEqual(['c']);
    expect((await store.queryNodes({ parent: null })).map((n) => n.id)).toEqual(['p']);
  });

  it('lists drifted and errored nodes', async () => {
    const store = new MemoryStore();
    await store.putNode(makeNode({ id: 'ok', title: 'ok', status: 'implemented' }));
    await store.putNode(makeNode({ id: 'd', title: 'd', status: 'drifted' }));
    await store.putNode(makeNode({ id: 'e', title: 'e', status: 'error' }));
    expect((await store.listDrifted()).map((n) => n.id).sort((a, b) => a.localeCompare(b))).toEqual(
      ['d', 'e'],
    );
  });

  it('records approval, moving an intended node to approved', async () => {
    const store = new MemoryStore();
    await store.putNode(makeNode({ id: 'n', title: 'n', status: 'intended' }));
    await store.recordApproval('n', '2026-02-02T00:00:00Z');
    expect((await store.getNode('n'))?.status).toBe('approved');
  });

  it('rolls back a failed transaction', async () => {
    const store = new MemoryStore();
    await store.putNode(makeNode({ id: 'n', title: 'before' }));
    await expect(
      store.transaction(async (tx) => {
        await tx.putNode(makeNode({ id: 'n', title: 'after' }));
        await tx.putNode(makeNode({ id: 'm', title: 'new' }));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await store.getNode('n'))?.title).toBe('before');
    expect(await store.getNode('m')).toBeNull();
  });

  it('commits a successful transaction and returns its value', async () => {
    const store = new MemoryStore();
    const result = await store.transaction(async (tx) => {
      await tx.putNode(makeNode({ id: 'n', title: 'committed' }));
      return 42;
    });
    expect(result).toBe(42);
    expect((await store.getNode('n'))?.title).toBe('committed');
  });
});
