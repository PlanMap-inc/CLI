import type { Node } from './model';

/**
 * Build a fully-valid `Node` for tests, overriding any fields. Not part of the
 * public API surface (imported directly by test files, not re-exported from the
 * package index).
 */
export function makeNode(over: Partial<Node> & Pick<Node, 'id' | 'title'>): Node {
  const base: Node = {
    id: over.id,
    graph: 'evolution',
    level: 'feature_space',
    type: 'element',
    title: over.title,
    status: 'implemented',
    origin: 'ai_generated',
    parent: null,
    edges_out: [],
    lens_tags: [],
    linked_code: [],
    depends_on: [],
    depended_on_by: [],
    created_at: '2026-01-01T00:00:00Z',
  };
  return { ...base, ...over };
}
