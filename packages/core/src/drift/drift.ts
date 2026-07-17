import type { Hash } from '../connector';
import type { LLMProvider } from '../llm';
import type { Drift, LinkedCode, Node } from '../model';
import type { StorageAdapter } from '../store';

export interface DriftReport {
  /** Node ids re-verified clean (and healed back to implemented if previously flagged). */
  verified: string[];
  /** Node ids flagged drifted (linked code changed since approval). */
  drifted: string[];
  /** Node ids flagged error (linked code missing or unreadable). */
  errored: string[];
}

export interface VerifyInputs {
  store: StorageAdapter;
  /**
   * The current, whitespace-normalized fingerprint of a linked range — supplied
   * by a connector reading the real code. `null` means the code is gone/unreadable.
   */
  currentHash: (link: LinkedCode) => Hash | null | Promise<Hash | null>;
  /** Optional narrator for the drift `issue`; never decides whether drift occurred. */
  llm?: LLMProvider;
  /** Injectable timestamp for deterministic tests. */
  now?: string;
}

async function narrateDrift(llm: LLMProvider, node: Node, file: string): Promise<string | null> {
  const intent = node.intent ?? node.summary ?? node.title;
  const prompt =
    `The approved intent for "${node.title}" is: ${intent}. The linked code in ${file} ` +
    `changed since approval. In one sentence, describe what likely diverged. Be factual.`;
  try {
    const text = await llm.complete(prompt, { maxTokens: 80 });
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Verify every node with linked code against an approved baseline.
 *
 * The DECISION is a deterministic hash comparison (the connector's fingerprint
 * is whitespace-normalized, so a reformat is not drift); the LLM only narrates
 * the `issue`. A node with no `approved_against` baseline cannot drift — it is
 * just unmapped reality and is skipped.
 */
export async function verify(inputs: VerifyInputs): Promise<DriftReport> {
  const { store, currentHash, llm } = inputs;
  const now = inputs.now ?? new Date().toISOString();
  const report: DriftReport = { verified: [], drifted: [], errored: [] };

  const nodes = await store.queryNodes();
  for (const node of nodes) {
    if (node.linked_code.length === 0 || !node.approved_against) continue;

    let missingFile: string | null = null;
    let changedFile: string | null = null;
    for (const link of node.linked_code) {
      const cur = await currentHash(link);
      if (cur === null) {
        missingFile = link.path;
        break;
      }
      link.current_hash = cur;
      if (cur !== link.hash) changedFile = link.path;
    }

    if (missingFile !== null) {
      node.status = 'error';
      node.drift = {
        detected_at: now,
        file: missingFile,
        issue: 'Linked code is missing or unreadable.',
        likely_cause: 'The file was removed or moved outside PlanMap.',
      };
      node.last_verified = now;
      await store.putNode(node);
      report.errored.push(node.id);
    } else if (changedFile !== null) {
      const drift: Drift = {
        detected_at: now,
        file: changedFile,
        issue: 'Linked code changed since this node was approved.',
        likely_cause: 'Modified outside PlanMap — no approved plan change corresponds to it.',
      };
      if (llm) {
        const narrated = await narrateDrift(llm, node, changedFile);
        if (narrated) drift.issue = narrated;
      }
      node.status = 'drifted';
      node.drift = drift;
      node.last_verified = now;
      await store.putNode(node);
      report.drifted.push(node.id);
    } else {
      // Clean — heal a previously-flagged node back to implemented.
      if (node.status === 'drifted' || node.status === 'error') node.status = 'implemented';
      node.drift = null;
      node.last_verified = now;
      await store.putNode(node);
      report.verified.push(node.id);
    }
  }

  return report;
}
