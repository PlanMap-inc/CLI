import { describe, expect, it } from 'vitest';

import { makeNode } from '../testing';

import { autoMap, placeObservation } from './automap';
import type { RepoStructure } from './types';

const structure: RepoStructure = {
  units: [
    { id: 'u_repo', kind: 'repo', title: 'food-app', parent: null },
    { id: 'u_login', kind: 'feature', title: 'Login', parent: 'u_repo' },
    {
      id: 'u_jwt',
      kind: 'element',
      title: 'verifyToken',
      parent: 'u_login',
      file: 'src/auth/jwt.ts',
      range: [1, 40],
      symbol: 'verifyToken',
      hash: 'H1',
      lensTags: ['security'],
    },
    {
      id: 'u_login_ctrl',
      kind: 'element',
      title: 'login',
      parent: 'u_login',
      file: 'src/auth/login.ts',
      range: [1, 30],
      symbol: 'login',
      hash: 'H2',
    },
    { id: 'u_browse', kind: 'feature', title: 'Browse', parent: 'u_repo' },
  ],
  facts: {
    files: ['src/auth/jwt.ts', 'src/auth/login.ts'],
    edges: [
      {
        fromFile: 'src/auth/login.ts',
        fromSymbol: 'login',
        toFile: 'src/auth/jwt.ts',
        toSymbol: 'verifyToken',
        kind: 'call',
      },
    ],
  },
};

describe('autoMap', () => {
  const { nodes, edges } = autoMap(structure, '2026-01-01T00:00:00Z');

  it('derives evolution nodes from the repo with no manual entry (T-MAP)', () => {
    expect(nodes).toHaveLength(5);
    const login = nodes.find((n) => n.id === 'u_login');
    expect(login?.type).toBe('feature');
    expect(login?.level).toBe('constellation');
    expect(login?.graph).toBe('evolution');
    expect(login?.status).toBe('implemented');

    const jwt = nodes.find((n) => n.id === 'u_jwt');
    expect(jwt?.level).toBe('feature_space');
    expect(jwt?.linked_code[0]?.path).toBe('src/auth/jwt.ts');
    expect(jwt?.linked_code[0]?.hash).toBe('H1');
    expect(jwt?.lens_tags).toContain('security');
  });

  it('derives typed edges and dependency rollups from static facts', () => {
    const call = edges.find((e) => e.from === 'u_login_ctrl' && e.to === 'u_jwt');
    expect(call?.type).toBe('calls');
    expect(call?.confidence).toBe('certain');
    expect(nodes.find((n) => n.id === 'u_login_ctrl')?.depends_on).toContain('u_jwt');
    expect(nodes.find((n) => n.id === 'u_jwt')?.depended_on_by).toContain('u_login_ctrl');
  });
});

describe('placeObservation (Evolution placement rule)', () => {
  const existing = [
    makeNode({ id: 'login', title: 'Login', type: 'feature', parent: 'repo', linked_code: [] }),
    makeNode({
      id: 'login_impl',
      title: 'login handler',
      type: 'element',
      parent: 'login',
      linked_code: [{ path: 'src/auth/login.ts', range: [1, 30], hash: 'h' }],
    }),
    makeNode({ id: 'browse', title: 'Browse', type: 'feature', parent: 'repo', linked_code: [] }),
  ];

  it('nests a change under the feature whose code it touches — semantic, not keyword', () => {
    // "improve login speed" touches login.ts => under Login, NOT a "Performance" node
    expect(placeObservation(['src/auth/login.ts'], existing)).toBe('login');
  });

  it('returns null (new top-level) when nothing existing is touched', () => {
    expect(placeObservation(['src/cart/cart.ts'], existing)).toBeNull();
  });
});
