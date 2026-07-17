import type { Confidence } from '../model';

/** Categories flagged as high-risk when an affected item touches them. */
export type RiskFlag = 'auth' | 'payments' | 'user_data' | 'migrations';

export interface AffectedItem {
  /** The affected plan/evolution node, when the impact maps to one. */
  nodeId?: string;
  path: string;
  symbol?: string;
  kind: 'node' | 'file' | 'function';
  /** Certain (direct reference) vs. inferred (weaker signal). Always visible. */
  confidence: Confidence;
  /** LLM narration of *why* this is affected; `null` when no provider is configured. */
  why: string | null;
}

/**
 * The output of Impact Analysis. The `affected` set and `dependencies` are
 * decided by static analysis (deterministic); only each item's `why` comes from
 * the LLM. Same code + same edit ⇒ identical `affected`, every run.
 */
export interface ImpactResult {
  editedNode: string;
  affected: AffectedItem[];
  dependencies: { depends_on: string[]; depended_on_by: string[] };
  riskFlags: RiskFlag[];
}
