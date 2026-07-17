import type { Edge, ImpactResult, Node } from '@planmap/core';
import type {
  EvoNode,
  ImpactView,
  Lens,
  PlanGraphView,
  PlanNodeVM,
  PlanStatus,
  Provenance,
} from '@planmap/ui';

/**
 * Maps engine data onto the `@planmap/ui` view-model. This is the only place that
 * knows both worlds; keeping it in the app preserves `@planmap/ui`'s purity. Layout
 * coordinates are assigned here (the engine graph has none) — a simple, deterministic
 * vertical stack that React Flow then fits to the viewport.
 */

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

const FEATURE_ACCENTS = [
  '--pm-c-auth',
  '--pm-c-browse',
  '--pm-c-cart',
  '--pm-c-checkout',
  '--pm-c-payments',
  '--pm-c-tracking',
  '--pm-c-ratings',
];

const LENS_ACCENT: Record<Lens, string> = {
  business: '--pm-lens-business',
  backend: '--pm-lens-backend',
  security: '--pm-lens-security',
  frontend: '--pm-tag-frontend',
};

const cssVar = (name: string): string => `var(${name})`;
const byTitle = (a: Node, b: Node): number => a.title.localeCompare(b.title);

const COL_X = 280;
const ROW_Y = 150;

function childrenOf(nodes: Node[], parentId: string): Node[] {
  return nodes.filter((n) => n.parent === parentId).sort(byTitle);
}

/** All descendants of a node, any depth. */
function descendantsOf(nodes: Node[], rootId: string): Node[] {
  const out: Node[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const child of nodes.filter((n) => n.parent === id)) {
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

/** The worst status in a set, so a feature card surfaces a drifted descendant. */
function rollupStatus(feature: Node, descendants: Node[]): PlanStatus {
  if (descendants.some((n) => n.status === 'error')) return 'error';
  if (descendants.some((n) => n.status === 'drifted')) return 'drifted';
  return feature.status;
}

/** Map every node to the id of the feature that encloses it (if any). */
function featureIndex(nodes: Node[]): Map<string, string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const result = new Map<string, string>();
  for (const node of nodes) {
    let cur: Node | undefined = node;
    for (let i = 0; i < 100 && cur; i += 1) {
      if (cur.type === 'feature') {
        result.set(node.id, cur.id);
        break;
      }
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
  }
  return result;
}

/** The top-level Constellation: one card per feature, with cross-feature edges. */
export function toConstellation(graph: Graph): PlanGraphView {
  const features = graph.nodes.filter((n) => n.type === 'feature').sort(byTitle);
  const nodes: PlanNodeVM[] = features.map((feature, i) => {
    const descendants = descendantsOf(graph.nodes, feature.id);
    const elementCount = descendants.filter((n) => n.type === 'element').length;
    return {
      id: feature.id,
      title: feature.title,
      sub: `${elementCount} ${elementCount === 1 ? 'node' : 'nodes'}`,
      status: rollupStatus(feature, descendants),
      color: cssVar(FEATURE_ACCENTS[i % FEATURE_ACCENTS.length] as string),
      x: COL_X,
      y: i * ROW_Y,
    };
  });

  const featureOf = featureIndex(graph.nodes);
  const seen = new Set<string>();
  const edges = [];
  for (const edge of graph.edges) {
    const from = featureOf.get(edge.from);
    const to = featureOf.get(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: key, from, to });
  }
  return { nodes, edges };
}

/** The Feature Space for one feature: its elements as steps, filtered by lens. */
export function toFeatureSpace(graph: Graph, featureId: string, lens: Lens): PlanGraphView {
  let elements = descendantsOf(graph.nodes, featureId).filter((n) => n.type === 'element');
  // `business` is the unfiltered overview; other lenses narrow to their tag.
  if (lens !== 'business') {
    elements = elements.filter((n) => (n.lens_tags as string[]).includes(lens));
  }
  elements.sort(byTitle);

  const idSet = new Set(elements.map((e) => e.id));
  const color = cssVar(LENS_ACCENT[lens]);
  const nodes: PlanNodeVM[] = elements.map((el, i) => ({
    id: el.id,
    title: el.title,
    sub: el.linked_code[0]?.path.split('/').pop(),
    status: el.status,
    color,
    x: COL_X,
    y: i * ROW_Y,
  }));
  const edges = graph.edges
    .filter((e) => idSet.has(e.from) && idSet.has(e.to))
    .map((e) => ({ id: e.id, from: e.from, to: e.to }));
  return { nodes, edges };
}

/** Build the read-only Evolution tree from parent relationships. */
export function toEvoTree(graph: Graph): EvoNode {
  const build = (node: Node): EvoNode => ({
    id: node.id,
    title: node.title,
    status: node.status,
    tags: [...node.lens_tags],
    children: childrenOf(graph.nodes, node.id).map(build),
    detail: {
      prompt: node.prompt ?? undefined,
      summary: node.summary ?? undefined,
      annotation: node.annotation ?? undefined,
      files: node.linked_code.map((l) => ({ path: l.path, range: `${l.range[0]}–${l.range[1]}` })),
      drift: node.drift ? { issue: node.drift.issue, cause: node.drift.likely_cause } : undefined,
    },
  });

  const repo = graph.nodes.find((n) => n.type === 'repo');
  if (repo) return build(repo);

  // No repo node: synthesize a root over the parentless nodes.
  const roots = graph.nodes.filter((n) => n.parent === null).sort(byTitle);
  return {
    id: 'root',
    title: 'Repository',
    status: 'implemented',
    tags: [],
    children: roots.map(build),
  };
}

function provenanceOf(why: string | null, confidence: 'certain' | 'inferred'): Provenance {
  if (why) return 'llm';
  return confidence === 'inferred' ? 'unsure' : 'parser';
}

/** Map an engine ImpactResult to the panel view-model, given the node's title. */
export function toImpactView(result: ImpactResult, title: string): ImpactView {
  const affected = result.affected.map((a) => ({
    path: a.path,
    why: a.why,
    provenance: provenanceOf(a.why, a.confidence),
  }));
  const confidence =
    result.affected.length === 0
      ? 'inferred'
      : result.affected.every((a) => a.confidence === 'certain')
        ? 'high'
        : 'medium';
  const risk = result.riskFlags.length > 0 ? 'high' : result.affected.length > 3 ? 'medium' : 'low';
  return { title, affected, risk, confidence, riskFlags: [...result.riskFlags] };
}
