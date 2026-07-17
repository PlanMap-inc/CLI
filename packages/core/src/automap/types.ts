import type { DepFacts } from '../depgraph';
import type { LensTag } from '../model';

/**
 * A normalized, language-agnostic description of one thing found in a repo,
 * produced by a `LanguageAnalyzer` (ts-morph for TS today; tree-sitter for
 * other languages later). `automap` turns these into graph nodes — so adding a
 * language never touches the engine.
 */
export interface RepoUnit {
  id: string;
  kind: 'repo' | 'module' | 'feature' | 'step' | 'element';
  title: string;
  parent: string | null;
  file?: string;
  range?: [number, number];
  symbol?: string;
  /** Fingerprint of the unit's range (whitespace-normalized), for future drift. */
  hash?: string;
  lensTags?: LensTag[];
}

export interface RepoStructure {
  units: RepoUnit[];
  facts: DepFacts;
}
