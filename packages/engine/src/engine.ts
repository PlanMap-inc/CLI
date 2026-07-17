import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { analyzeTypeScriptRepo, fingerprintRange } from '@planmap/connectors';
import {
  analyzeImpact,
  autoMap,
  buildDepGraph,
  composeHandoff,
  graphToMarkdown,
  verify,
  type DriftReport,
  type ImpactResult,
  type ImpactTarget,
  type LinkedCode,
  type LLMProvider,
  type Node,
} from '@planmap/core';
import { LocalStore, projectionsDir } from '@planmap/db';

export interface MapResult {
  nodes: number;
  edges: number;
}

/** Initialize a `.planmap` store (idempotent). */
export async function initStore(root: string): Promise<void> {
  await LocalStore.open(root);
}

/** Analyze a repo and auto-populate the Evolution graph into its store. */
export async function mapRepo(
  repoRoot: string,
  storeRoot: string = repoRoot,
  now: string = new Date().toISOString(),
): Promise<MapResult> {
  const structure = analyzeTypeScriptRepo(repoRoot);
  const { nodes, edges } = autoMap(structure, now);
  const store = await LocalStore.open(storeRoot);
  await store.transaction(async (tx) => {
    for (const node of nodes) await tx.putNode(node);
    for (const edge of edges) await tx.putEdge(edge);
  });
  return { nodes: nodes.length, edges: edges.length };
}

async function reverseIndex(store: LocalStore): Promise<(file: string) => Node[]> {
  const all = await store.queryNodes();
  const byFile = new Map<string, Node[]>();
  for (const node of all) {
    for (const link of node.linked_code) {
      const arr = byFile.get(link.path);
      if (arr) arr.push(node);
      else byFile.set(link.path, [node]);
    }
  }
  return (file: string): Node[] => byFile.get(file) ?? [];
}

/** Run Impact Analysis for a node (parser WHAT + optional LLM WHY). */
export async function impactForNode(
  nodeId: string,
  repoRoot: string,
  storeRoot: string = repoRoot,
  llm?: LLMProvider,
): Promise<ImpactResult> {
  const store = await LocalStore.open(storeRoot);
  const node = await store.getNode(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  const structure = analyzeTypeScriptRepo(repoRoot);
  const depgraph = buildDepGraph(structure.facts);
  const targets: ImpactTarget[] = node.linked_code.map((link) => ({
    file: link.path,
    symbol: link.symbol,
  }));
  const nodesForFile = await reverseIndex(store);
  return analyzeImpact({ editedNode: node, targets, depgraph, nodesForFile, llm });
}

/** Approve a node, making it the baseline drift is measured against. */
export async function approveNode(
  nodeId: string,
  storeRoot: string,
  now: string = new Date().toISOString(),
): Promise<void> {
  const store = await LocalStore.open(storeRoot);
  const node = await store.getNode(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  // M1 has a single (Evolution) graph, so a node is its own baseline.
  node.approved_against = node.id;
  await store.putNode(node);
  await store.recordApproval(nodeId, now);
}

/** Verify every approved node's linked code against its baseline. */
export async function driftCheck(
  repoRoot: string,
  storeRoot: string = repoRoot,
  llm?: LLMProvider,
  now: string = new Date().toISOString(),
): Promise<DriftReport> {
  const store = await LocalStore.open(storeRoot);
  const cache = new Map<string, string | null>();
  const readSource = async (path: string): Promise<string | null> => {
    const cached = cache.get(path);
    if (cached !== undefined) return cached;
    let content: string | null;
    try {
      content = await readFile(join(repoRoot, path), 'utf8');
    } catch {
      content = null;
    }
    cache.set(path, content);
    return content;
  };
  const currentHash = async (link: LinkedCode): Promise<string | null> => {
    const content = await readSource(link.path);
    return content === null ? null : fingerprintRange(content, [link.range[0], link.range[1]]);
  };
  return verify({ store, currentHash, llm, now });
}

/** Compose the scoped instruction for the developer's own coding agent. */
export async function handoffForNode(
  nodeId: string,
  repoRoot: string,
  storeRoot: string = repoRoot,
  llm?: LLMProvider,
): Promise<string> {
  const store = await LocalStore.open(storeRoot);
  const node = await store.getNode(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  const impact = await impactForNode(nodeId, repoRoot, storeRoot, llm);
  return composeHandoff(node, impact);
}

/** Regenerate the markdown projection of the Evolution graph. */
export async function projectMarkdown(storeRoot: string): Promise<string> {
  const store = await LocalStore.open(storeRoot);
  const nodes = await store.queryNodes({ graph: 'evolution' });
  const markdown = graphToMarkdown(nodes);
  await writeFile(join(projectionsDir(storeRoot), 'evolution.md'), markdown);
  return markdown;
}
