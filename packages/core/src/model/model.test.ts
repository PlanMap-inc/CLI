import { describe, expect, it } from 'vitest';

import { EdgeSchema, LinkedCodeSchema, NodeSchema } from './schemas';

const validNode = {
  id: 'node_0087',
  graph: 'evolution',
  level: 'feature_space',
  type: 'element',
  title: 'Added refresh tokens',
  summary: 'Issues a long-lived refresh token alongside the JWT.',
  status: 'implemented',
  origin: 'ai_generated',
  parent: 'node_0084',
  edges_out: ['node_0091'],
  lens_tags: ['security', 'backend'],
  linked_code: [{ path: 'src/auth/jwt.ts', range: [88, 141], hash: 'c4e2a1' }],
  depends_on: ['node_0084'],
  depended_on_by: ['node_0091'],
  approved_against: 'node_p084',
  annotation: '7-day refresh window — matches the weekly repeat-order pattern.',
  created_at: '2026-07-06T17:48:00Z',
};

describe('NodeSchema', () => {
  it('parses a fully-specified node', () => {
    const parsed = NodeSchema.parse(validNode);
    expect(parsed.id).toBe('node_0087');
    expect(parsed.lens_tags).toContain('security');
    expect(parsed.linked_code[0]?.range).toEqual([88, 141]);
  });

  it('applies array defaults when arrays are omitted', () => {
    const minimal = {
      id: 'n1',
      graph: 'plan',
      level: 'constellation',
      type: 'feature',
      title: 'Login',
      status: 'intended',
      origin: 'manually_added',
      parent: null,
      created_at: '2026-01-01T00:00:00Z',
    };
    const parsed = NodeSchema.parse(minimal);
    expect(parsed.edges_out).toEqual([]);
    expect(parsed.lens_tags).toEqual([]);
    expect(parsed.linked_code).toEqual([]);
    expect(parsed.depends_on).toEqual([]);
  });

  it('rejects an invalid status', () => {
    expect(() => NodeSchema.parse({ ...validNode, status: 'nonsense' })).toThrow();
  });

  it('rejects an invalid node type', () => {
    expect(() => NodeSchema.parse({ ...validNode, type: 'widget' })).toThrow();
  });

  it('rejects a lens tag outside the allowed set', () => {
    expect(() => NodeSchema.parse({ ...validNode, lens_tags: ['performance'] })).toThrow();
  });
});

describe('LinkedCodeSchema', () => {
  it('requires path, range, and hash', () => {
    expect(() => LinkedCodeSchema.parse({ path: 'a.ts' })).toThrow();
  });

  it('parses a valid linked-code entry', () => {
    const ok = LinkedCodeSchema.parse({ path: 'a.ts', range: [1, 10], hash: 'abc' });
    expect(ok.range).toEqual([1, 10]);
    expect(ok.current_hash).toBeUndefined();
  });

  it('rejects a negative range bound', () => {
    expect(() => LinkedCodeSchema.parse({ path: 'a.ts', range: [-1, 10], hash: 'abc' })).toThrow();
  });
});

describe('EdgeSchema', () => {
  it('parses a valid edge with provenance + confidence', () => {
    const edge = EdgeSchema.parse({
      id: 'edge_0311',
      type: 'calls',
      from: 'node_0087',
      to: 'node_0084',
      graph: 'evolution',
      provenance: 'static_analysis',
      confidence: 'certain',
    });
    expect(edge.confidence).toBe('certain');
  });

  it('rejects an unknown edge type', () => {
    expect(() =>
      EdgeSchema.parse({
        id: 'e',
        type: 'frobnicates',
        from: 'a',
        to: 'b',
        graph: 'plan',
        provenance: 'manual',
        confidence: 'inferred',
      }),
    ).toThrow();
  });
});
