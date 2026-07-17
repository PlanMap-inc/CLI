/**
 * The view-model `@planmap/ui` renders. It is intentionally plain data with no
 * dependency on the engine: the web app maps real engine types onto these shapes,
 * and Storybook/tests use fixtures of the same shape. Components take a view-model
 * in and emit callbacks out — they never fetch, and never know if data is real.
 */

/** Lifecycle of a plan/evolution node. `drifted`/`error` are visible failure states. */
export type PlanStatus = 'intended' | 'approved' | 'implemented' | 'drifted' | 'error';

export const PLAN_STATUSES: readonly PlanStatus[] = [
  'intended',
  'approved',
  'implemented',
  'drifted',
  'error',
] as const;

/**
 * The Feature-Space lenses — each reframes the same feature in a different register.
 * These mirror the engine's lens tags exactly so a lens can filter on real data;
 * `business` is the unfiltered default. (A `database` lens returns with the DB
 * connector in a later milestone.)
 */
export type Lens = 'business' | 'backend' | 'security' | 'frontend';

/**
 * Where a claim came from. This is surfaced in the UI because "parser-grounded,
 * never invented" is the product's moat: a fact from static analysis reads
 * differently from LLM narration, and `unsure` is shown rather than guessed.
 */
export type Provenance = 'parser' | 'llm' | 'unsure';

export type Risk = 'low' | 'medium' | 'high';
export type Confidence = 'high' | 'medium' | 'low' | 'inferred' | 'unsure';

export interface FileRef {
  path: string;
  /** Human range label, e.g. "42–78". */
  range?: string;
}

/** A node on the pannable Plan Graph (Constellation feature, or Feature-Space step). */
export interface PlanNodeVM {
  id: string;
  title: string;
  /** Small caption, e.g. "8 nodes" or "step 3 of 7". */
  sub?: string;
  status: PlanStatus;
  /** CSS color for the accent bar; defaults to a neutral if absent. */
  color?: string;
  x: number;
  y: number;
}

export interface EdgeVM {
  id: string;
  from: string;
  to: string;
}

export interface PlanGraphView {
  nodes: PlanNodeVM[];
  edges: EdgeVM[];
}

/** One affected site in an Impact Analysis result. `why` is null when no LLM narrated it. */
export interface ImpactAffected {
  path: string;
  range?: string;
  why: string | null;
  provenance: Provenance;
}

export interface ImpactView {
  title: string;
  affected: ImpactAffected[];
  /** Optional dependency prose (LLM). */
  dependencies?: string;
  risk: Risk;
  confidence: Confidence;
  /** Domain flags such as `security`/`auth`, surfaced as badges. */
  riskFlags?: string[];
}

export interface DriftInfo {
  issue: string;
  cause?: string;
}

export interface EvoDetail {
  prompt?: string;
  summary?: string;
  files?: FileRef[];
  annotation?: string;
  drift?: DriftInfo;
}

/** A node in the read-only Evolution tree (what actually exists, derived from code). */
export interface EvoNode {
  id: string;
  title: string;
  status: PlanStatus;
  tags: string[];
  children: EvoNode[];
  detail?: EvoDetail;
}
