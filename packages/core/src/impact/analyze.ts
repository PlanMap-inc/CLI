import type { DepGraph, Dependent } from '../depgraph';
import type { LLMProvider } from '../llm';
import type { Node } from '../model';

import { classifyRisk } from './risk';
import type { AffectedItem, ImpactResult } from './types';

/** A location the edited node owns — a file and optionally a specific symbol. */
export interface ImpactTarget {
  file: string;
  symbol?: string;
}

export interface ImpactInputs {
  editedNode: Node;
  /** Locations the edited node owns (from its linked_code, resolved by a connector). */
  targets: ImpactTarget[];
  depgraph: DepGraph;
  /** Map an affected file back to the node(s) that link it (store-backed). Optional. */
  nodesForFile?: (file: string) => Node[];
  /** Optional narrator. Absent ⇒ the WHAT is still returned; each `why` stays null. */
  llm?: LLMProvider;
}

function affectedKind(hasNode: boolean, hasSymbol: boolean): AffectedItem['kind'] {
  if (hasNode) return 'node';
  return hasSymbol ? 'function' : 'file';
}

async function narrate(llm: LLMProvider, edited: Node, item: AffectedItem): Promise<string | null> {
  const where = item.symbol ? `${item.path} (${item.symbol})` : item.path;
  const prompt =
    `In one sentence, explain why "${where}" is affected when the plan node ` +
    `"${edited.title}" changes. Be concrete and factual; do not speculate beyond the dependency.`;
  try {
    const text = await llm.complete(prompt, { maxTokens: 80 });
    return text.trim() || null;
  } catch {
    // The narrator is best-effort — a provider failure must never break the WHAT.
    return null;
  }
}

/**
 * Impact Analysis. The affected set and dependencies are decided entirely by
 * static analysis (deterministic — same input yields the same set every run);
 * the LLM is only a narrator that fills each item's `why`. If no provider is
 * given, the WHAT is still complete and correct.
 */
export async function analyzeImpact(inputs: ImpactInputs): Promise<ImpactResult> {
  const { editedNode, targets, depgraph, nodesForFile, llm } = inputs;

  // 1. WHAT — merge dependents across targets, keeping the shortest-distance
  //    (strongest) signal per (file, symbol). No LLM in this path.
  const byKey = new Map<string, Dependent>();
  for (const target of targets) {
    for (const dep of depgraph.dependentsOf(target.file, target.symbol)) {
      const key = `${dep.file} ${dep.symbol ?? ''}`;
      const existing = byKey.get(key);
      if (!existing || dep.distance < existing.distance) byKey.set(key, dep);
    }
  }

  const ordered = [...byKey.values()].sort(
    (a, b) =>
      a.distance - b.distance ||
      a.file.localeCompare(b.file) ||
      (a.symbol ?? '').localeCompare(b.symbol ?? ''),
  );

  const affected: AffectedItem[] = ordered.map((dep) => {
    const node = nodesForFile ? nodesForFile(dep.file)[0] : undefined;
    const item: AffectedItem = {
      path: dep.file,
      kind: affectedKind(Boolean(node), Boolean(dep.symbol)),
      confidence: dep.confidence,
      why: null,
    };
    if (node) item.nodeId = node.id;
    if (dep.symbol) item.symbol = dep.symbol;
    return item;
  });

  // 2. RISK — rule-based over the edited node + affected paths.
  const riskFlags = classifyRisk(editedNode, affected);

  // 3. Dependencies — the node's cached rollups.
  const dependencies = {
    depends_on: editedNode.depends_on ?? [],
    depended_on_by: editedNode.depended_on_by ?? [],
  };

  // 4. WHY — optional narration; never alters the affected set.
  if (llm) {
    for (const item of affected) {
      item.why = await narrate(llm, editedNode, item);
    }
  }

  return { editedNode: editedNode.id, affected, dependencies, riskFlags };
}
