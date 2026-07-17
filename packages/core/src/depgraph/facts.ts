/**
 * Normalized dependency facts, produced by a connector's static analysis
 * (never by the LLM). The engine reasons purely over these facts, so it stays
 * I/O-free and unit-testable against fixtures.
 */

/**
 * A directed dependency: `fromFile` (optionally a symbol within it) references
 * `toFile` (optionally a specific symbol in it).
 *
 * `confidence` records how the fact was established: `certain` for compiler-resolved
 * references (ts-morph), `inferred` for name-matched ones (tree-sitter has no type
 * resolution, so a cross-file call is matched by symbol name — a strong signal, not a
 * proof). Omitted means `certain`. This is what lets the moat — "we don't invent
 * dependencies" — hold across languages: an inferred edge is shown as inferred, never
 * dressed up as fact.
 */
export interface DepEdge {
  fromFile: string;
  fromSymbol?: string;
  toFile: string;
  toSymbol?: string;
  kind: 'import' | 'call' | 'reference';
  confidence?: 'certain' | 'inferred';
}

export interface DepFacts {
  files: string[];
  edges: DepEdge[];
}
