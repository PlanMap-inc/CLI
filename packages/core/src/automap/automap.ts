import type { DepEdge } from '../depgraph';
import type { Edge, Node } from '../model';

import type { RepoStructure, RepoUnit } from './types';

function unitToNode(unit: RepoUnit, now: string): Node {
  const level = unit.kind === 'step' || unit.kind === 'element' ? 'feature_space' : 'constellation';
  return {
    id: unit.id,
    graph: 'evolution',
    level,
    type: unit.kind,
    title: unit.title,
    status: 'implemented',
    origin: 'ai_generated',
    parent: unit.parent,
    edges_out: [],
    lens_tags: unit.lensTags ?? [],
    linked_code: unit.file
      ? [
          {
            path: unit.file,
            range: unit.range ?? [1, 1],
            hash: unit.hash ?? '',
            symbol: unit.symbol,
          },
        ]
      : [],
    depends_on: [],
    depended_on_by: [],
    created_at: now,
  };
}

function edgeType(kind: DepEdge['kind']): Edge['type'] {
  if (kind === 'import') return 'imports';
  if (kind === 'call') return 'calls';
  return 'depends_on';
}

/**
 * Derive the Evolution Graph (what actually exists) from a connector's parsed
 * repo structure — no manual entry. Nodes come from units; typed edges and the
 * cached dependency rollups come from the static-analysis facts.
 */
export function autoMap(structure: RepoStructure, now: string): { nodes: Node[]; edges: Edge[] } {
  const nodes = structure.units.map((unit) => unitToNode(unit, now));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const resolve = (file: string, symbol?: string): string | undefined => {
    if (symbol) {
      const bySymbol = structure.units.find((u) => u.file === file && u.symbol === symbol);
      if (bySymbol) return bySymbol.id;
    }
    return structure.units.find((u) => u.file === file)?.id;
  };

  const edges: Edge[] = [];
  const seen = new Set<string>();
  let seq = 0;
  for (const fact of structure.facts.edges) {
    const from = resolve(fact.fromFile, fact.fromSymbol);
    const to = resolve(fact.toFile, fact.toSymbol);
    if (!from || !to || from === to) continue;
    const type = edgeType(fact.kind);
    const key = `${from}->${to}:${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seq += 1;
    edges.push({
      id: `edge_${seq}`,
      type,
      from,
      to,
      graph: 'evolution',
      provenance: 'static_analysis',
      confidence: 'certain',
    });
    const fromNode = nodeById.get(from);
    const toNode = nodeById.get(to);
    if (fromNode && !fromNode.depends_on.includes(to)) fromNode.depends_on.push(to);
    if (toNode && !toNode.depended_on_by.includes(from)) toNode.depended_on_by.push(from);
  }

  return { nodes, edges };
}

/**
 * The Evolution placement rule, semantic (never keyword): a change is placed
 * under the feature whose *code it touches*. "Improve login speed" touches
 * Login's files, so it nests under Login — not under a "Performance" node.
 * Returns the target feature's node id, or `null` for a new top-level capability.
 */
export function placeObservation(touchedFiles: string[], existing: Node[]): string | null {
  const touched = new Set(touchedFiles);
  const byId = new Map(existing.map((n) => [n.id, n]));

  const owners = existing.filter((n) => n.linked_code.some((link) => touched.has(link.path)));
  const first = [...owners].sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!first) return null; // step 3: nobody has touched this — new top-level

  // Walk up to the enclosing feature (or the topmost ancestor).
  let cur: Node | undefined = first;
  for (let i = 0; i < 100 && cur; i += 1) {
    if (cur.type === 'feature') return cur.id;
    if (!cur.parent) return cur.id;
    cur = byId.get(cur.parent);
  }
  return first.id;
}
