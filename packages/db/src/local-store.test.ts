import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeNode } from '@planmap/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalStore } from './local-store';
import { SCHEMA_VERSION } from './migrations';
import { configPath, nodesDir } from './paths';

describe('LocalStore', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'planmap-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('initializes a .planmap store at the current schema version', async () => {
    await LocalStore.open(dir);
    const config = JSON.parse(await readFile(configPath(dir), 'utf8')) as {
      version: number;
      edition: string;
    };
    expect(config.version).toBe(SCHEMA_VERSION);
    expect(config.edition).toBe('solo');
  });

  it('persists a node as JSON and reloads it (JSON is canonical)', async () => {
    const store = await LocalStore.open(dir);
    await store.putNode(makeNode({ id: 'n1', title: 'A' }));
    const onDisk = JSON.parse(await readFile(join(nodesDir(dir), 'n1.json'), 'utf8')) as {
      title: string;
    };
    expect(onDisk.title).toBe('A');
    const reopened = await LocalStore.open(dir);
    expect((await reopened.getNode('n1'))?.title).toBe('A');
  });

  it('rebuilds the in-memory index from JSON on open (T-INDEX-REBUILD)', async () => {
    const s1 = await LocalStore.open(dir);
    await s1.putNode(makeNode({ id: 'a', title: 'A', status: 'drifted' }));
    await s1.putNode(makeNode({ id: 'b', title: 'B' }));
    const s2 = await LocalStore.open(dir);
    expect((await s2.queryNodes()).map((n) => n.id).sort((x, y) => x.localeCompare(y))).toEqual([
      'a',
      'b',
    ]);
    expect((await s2.listDrifted()).map((n) => n.id)).toEqual(['a']);
  });

  it('rolls back a failed transaction on disk and in memory', async () => {
    const store = await LocalStore.open(dir);
    await store.putNode(makeNode({ id: 'n', title: 'before' }));
    await expect(
      store.transaction(async (tx) => {
        await tx.putNode(makeNode({ id: 'n', title: 'after' }));
        await tx.putNode(makeNode({ id: 'm', title: 'new' }));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const reopened = await LocalStore.open(dir);
    expect((await reopened.getNode('n'))?.title).toBe('before');
    expect(await reopened.getNode('m')).toBeNull();
  });

  it('records drift and lists it', async () => {
    const store = await LocalStore.open(dir);
    await store.putNode(makeNode({ id: 'n', title: 'x' }));
    await store.appendDrift('n', { detected_at: 'now', file: 'a.ts', issue: 'changed' });
    expect((await store.getNode('n'))?.status).toBe('drifted');
    expect((await store.listDrifted()).map((n) => n.id)).toEqual(['n']);
  });

  it('bumps an older store to the current version on open', async () => {
    await LocalStore.open(dir);
    const cfg = JSON.parse(await readFile(configPath(dir), 'utf8')) as Record<string, unknown>;
    cfg['version'] = 0;
    await writeFile(configPath(dir), JSON.stringify(cfg));
    await LocalStore.open(dir);
    const after = JSON.parse(await readFile(configPath(dir), 'utf8')) as { version: number };
    expect(after.version).toBe(SCHEMA_VERSION);
  });
});
