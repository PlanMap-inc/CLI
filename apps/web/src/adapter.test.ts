import type { Edge, ImpactResult, LensTag, Node, Status } from '@planmap/core';
import { describe, expect, it } from 'vitest';

import { toConstellation, toEvoTree, toFeatureSpace, toImpactView, type Graph } from './adapter';

let seq = 0;
function mk(
  type: Node['type'],
  title: string,
  parent: string | null,
  opts: { status?: Status; tags?: LensTag[]; file?: string } = {},
): Node {
  seq += 1;
  return {
    id: `${type}:${title}`,
    graph: 'evolution',
    level: type === 'element' ? 'feature_space' : 'constellation',
    type,
    title,
    status: opts.status ?? 'implemented',
    origin: 'ai_generated',
    parent,
    edges_out: [],
    lens_tags: opts.tags ?? [],
    linked_code: opts.file
      ? [{ path: opts.file, range: [1, 9], hash: `h${seq}`, symbol: title }]
      : [],
    depends_on: [],
    depended_on_by: [],
    created_at: '2026-01-01T00:00:00Z',
  };
}

function edge(from: string, to: string): Edge {
  return {
    id: `${from}->${to}`,
    type: 'calls',
    from,
    to,
    graph: 'evolution',
    provenance: 'static_analysis',
    confidence: 'certain',
  };
}

function fixture(): Graph {
  const nodes: Node[] = [
    mk('repo', 'sample', null),
    mk('feature', 'auth', 'repo:sample'),
    mk('module', 'jwt.ts', 'feature:auth'),
    mk('element', 'verifyToken', 'module:jwt.ts', { tags: ['security'], file: 'src/auth/jwt.ts' }),
    mk('feature', 'checkout', 'repo:sample'),
    mk('module', 'checkout.ts', 'feature:checkout'),
    mk('element', 'checkout', 'module:checkout.ts', { file: 'src/checkout/checkout.ts' }),
  ];
  // checkout() calls verifyToken() — a cross-feature dependency.
  const edges: Edge[] = [edge('element:checkout', 'element:verifyToken')];
  return { nodes, edges };
}

describe('toConstellation', () => {
  it('emits one card per feature with an element count', () => {
    const view = toConstellation(fixture());
    const titles = view.nodes.map((n) => n.title).sort();
    expect(titles).toEqual(['auth', 'checkout']);
    const auth = view.nodes.find((n) => n.title === 'auth');
    expect(auth?.sub).toBe('1 node');
  });

  it('derives a cross-feature edge from an element dependency', () => {
    const view = toConstellation(fixture());
    expect(view.edges).toContainEqual({
      id: 'feature:checkout->feature:auth',
      from: 'feature:checkout',
      to: 'feature:auth',
    });
  });

  it('rolls a drifted element up to its feature card', () => {
    const graph = fixture();
    const el = graph.nodes.find((n) => n.id === 'element:verifyToken');
    if (el) el.status = 'drifted';
    const view = toConstellation(graph);
    expect(view.nodes.find((n) => n.title === 'auth')?.status).toBe('drifted');
  });
});

describe('toFeatureSpace', () => {
  it('shows a feature’s elements as steps under the business lens', () => {
    const view = toFeatureSpace(fixture(), 'feature:auth', 'business');
    expect(view.nodes.map((n) => n.title)).toEqual(['verifyToken']);
    expect(view.nodes[0]?.sub).toBe('jwt.ts');
  });

  it('filters to a lens tag for non-business lenses', () => {
    const secure = toFeatureSpace(fixture(), 'feature:auth', 'security');
    expect(secure.nodes.map((n) => n.title)).toEqual(['verifyToken']);
    const backend = toFeatureSpace(fixture(), 'feature:auth', 'backend');
    expect(backend.nodes).toHaveLength(0);
  });
});

describe('toEvoTree', () => {
  it('builds the tree from the repo root down', () => {
    const tree = toEvoTree(fixture());
    expect(tree.title).toBe('sample');
    expect(tree.children.map((c) => c.title).sort()).toEqual(['auth', 'checkout']);
    const auth = tree.children.find((c) => c.title === 'auth');
    expect(auth?.children[0]?.title).toBe('jwt.ts');
  });
});

describe('toImpactView', () => {
  const result: ImpactResult = {
    editedNode: 'element:verifyToken',
    affected: [
      { path: 'src/auth/login.ts', kind: 'file', confidence: 'certain', why: null },
      {
        path: 'src/checkout/checkout.ts',
        kind: 'file',
        confidence: 'inferred',
        why: 'Reads the token.',
      },
    ],
    dependencies: { depends_on: [], depended_on_by: [] },
    riskFlags: ['auth'],
  };

  it('marks provenance from whether the LLM narrated and how confident the parser is', () => {
    const view = toImpactView(result, 'verifyToken');
    expect(view.affected[0]?.provenance).toBe('parser'); // fact, no narration
    expect(view.affected[1]?.provenance).toBe('llm'); // narrated
  });

  it('flags a security/auth impact as high risk', () => {
    const view = toImpactView(result, 'verifyToken');
    expect(view.risk).toBe('high');
    expect(view.riskFlags).toContain('auth');
  });

  it('reports medium confidence when any site is only inferred', () => {
    const view = toImpactView(result, 'verifyToken');
    expect(view.confidence).toBe('medium');
  });
});
