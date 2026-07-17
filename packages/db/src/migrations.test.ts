import { describe, expect, it } from 'vitest';

import { MIGRATIONS, migrate, SCHEMA_VERSION, type Migration, type RawStore } from './migrations';

describe('migrate (forward-migration runner)', () => {
  it('is a no-op at the current version with no pending migrations', () => {
    const raw: RawStore = { nodes: [{ id: 'n' }], edges: [] };
    const result = migrate(raw, SCHEMA_VERSION);
    expect(result.version).toBe(SCHEMA_VERSION);
    expect(result.raw).toEqual(raw);
  });

  it('applies pending migrations in order and reports the new version', () => {
    const migrations: Migration[] = [
      { to: 2, up: (r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, tier: 'solo' })) }) },
      { to: 3, up: (r) => ({ ...r, nodes: r.nodes.map((n) => ({ ...n, tier: 'team' })) }) },
    ];
    const result = migrate({ nodes: [{ id: 'n' }], edges: [] }, 1, migrations);
    expect(result.version).toBe(3);
    expect(result.raw.nodes[0]).toMatchObject({ id: 'n', tier: 'team' });
  });

  it('skips migrations at or below the from-version', () => {
    const migrations: Migration[] = [{ to: 2, up: (r) => ({ ...r, edges: [{ id: 'e' }] }) }];
    const result = migrate({ nodes: [], edges: [] }, 2, migrations);
    expect(result.version).toBe(2);
    expect(result.raw.edges).toEqual([]);
  });

  it('ships zero migrations at the v1 baseline', () => {
    expect(MIGRATIONS).toHaveLength(0);
    expect(SCHEMA_VERSION).toBe(1);
  });
});
