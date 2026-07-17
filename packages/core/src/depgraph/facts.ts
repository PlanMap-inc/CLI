/**
 * Normalized dependency facts, produced by a connector's static analysis
 * (never by the LLM). The engine reasons purely over these facts, so it stays
 * I/O-free and unit-testable against fixtures.
 */

/**
 * A directed dependency: `fromFile` (optionally a symbol within it) references
 * `toFile` (optionally a specific symbol in it).
 */
export interface DepEdge {
  fromFile: string;
  fromSymbol?: string;
  toFile: string;
  toSymbol?: string;
  kind: 'import' | 'call' | 'reference';
}

export interface DepFacts {
  files: string[];
  edges: DepEdge[];
}
