import { describe, expect, it } from 'vitest';

import type { LinkedCode } from '../model';
import { MemoryStore } from '../store';
import { makeNode } from '../testing';

import { verify } from './drift';

const NOW = '2026-07-15T14:22:00Z';

function linked(path: string, hash: string): LinkedCode {
  return { path, range: [1, 20], hash };
}

describe('verify (drift)', () => {
  it('flags drift when linked code changed since approval, preserving the annotation', async () => {
    const store = new MemoryStore();
    await store.putNode(
      makeNode({
        id: 'n_remember',
        title: 'Added remember me',
        status: 'implemented',
        approved_against: 'node_p080',
        annotation: '30-day window chosen deliberately — repeat-order behaviour is weekly.',
        linked_code: [linked('src/auth/login.ts', 'H1')],
      }),
    );

    const report = await verify({ store, now: NOW, currentHash: () => 'H2' });

    expect(report.drifted).toEqual(['n_remember']);
    const node = await store.getNode('n_remember');
    expect(node?.status).toBe('drifted');
    expect(node?.drift?.file).toBe('src/auth/login.ts');
    expect(node?.annotation).toContain('30-day window'); // the "why" survives the drift
  });

  it('does not flag a whitespace-only reformat (normalized hash unchanged)', async () => {
    const store = new MemoryStore();
    await store.putNode(
      makeNode({ id: 'n', title: 'x', approved_against: 'p', linked_code: [linked('a.ts', 'H1')] }),
    );
    const report = await verify({ store, now: NOW, currentHash: () => 'H1' });
    expect(report.verified).toEqual(['n']);
    expect((await store.getNode('n'))?.status).toBe('implemented');
  });

  it('does not flag a node with no approved baseline (unmapped reality)', async () => {
    const store = new MemoryStore();
    await store.putNode(
      makeNode({
        id: 'n',
        title: 'x',
        approved_against: null,
        linked_code: [linked('a.ts', 'H1')],
      }),
    );
    const report = await verify({ store, now: NOW, currentHash: () => 'H2' });
    expect(report.drifted).toEqual([]);
    expect(report.verified).toEqual([]);
  });

  it('flags error when the linked code is missing', async () => {
    const store = new MemoryStore();
    await store.putNode(
      makeNode({
        id: 'n',
        title: 'x',
        approved_against: 'p',
        linked_code: [linked('gone.ts', 'H1')],
      }),
    );
    const report = await verify({ store, now: NOW, currentHash: () => null });
    expect(report.errored).toEqual(['n']);
    expect((await store.getNode('n'))?.status).toBe('error');
  });

  it('heals a previously-drifted node when the code matches again', async () => {
    const store = new MemoryStore();
    await store.putNode(
      makeNode({
        id: 'n',
        title: 'x',
        status: 'drifted',
        approved_against: 'p',
        linked_code: [linked('a.ts', 'H1')],
      }),
    );
    const report = await verify({ store, now: NOW, currentHash: () => 'H1' });
    expect(report.verified).toEqual(['n']);
    expect((await store.getNode('n'))?.status).toBe('implemented');
  });

  it('narrates the issue with an LLM without changing the drift decision', async () => {
    const store = new MemoryStore();
    await store.putNode(
      makeNode({ id: 'n', title: 'x', approved_against: 'p', linked_code: [linked('a.ts', 'H1')] }),
    );
    const report = await verify({
      store,
      now: NOW,
      currentHash: () => 'H2',
      llm: { complete: async () => 'Session lifetime is now hardcoded to 24h.' },
    });
    expect(report.drifted).toEqual(['n']);
    expect((await store.getNode('n'))?.drift?.issue).toBe(
      'Session lifetime is now hardcoded to 24h.',
    );
  });
});
