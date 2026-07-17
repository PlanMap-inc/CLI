import { describe, expect, it } from 'vitest';

import { buildDepGraph } from './depgraph';
import type { DepFacts } from './facts';

// a.ts exports symbolX; b/c/d each call symbolX directly; e.ts depends on b.ts
// (transitive); unrelated.ts touches nothing related.
const facts: DepFacts = {
  files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'unrelated.ts'],
  edges: [
    { fromFile: 'b.ts', fromSymbol: 'useB', toFile: 'a.ts', toSymbol: 'symbolX', kind: 'call' },
    { fromFile: 'c.ts', fromSymbol: 'useC', toFile: 'a.ts', toSymbol: 'symbolX', kind: 'call' },
    { fromFile: 'd.ts', fromSymbol: 'useD', toFile: 'a.ts', toSymbol: 'symbolX', kind: 'call' },
    { fromFile: 'e.ts', fromSymbol: 'useE', toFile: 'b.ts', toSymbol: 'useB', kind: 'call' },
    { fromFile: 'a.ts', toFile: 'other.ts', toSymbol: 'helper', kind: 'import' },
    { fromFile: 'unrelated.ts', toFile: 'somewhere.ts', kind: 'import' },
  ],
};

describe('buildDepGraph.dependentsOf', () => {
  it('finds exactly the direct dependents of a symbol, marked certain', () => {
    const graph = buildDepGraph(facts);
    const direct = graph
      .dependentsOf('a.ts', 'symbolX')
      .filter((d) => d.confidence === 'certain')
      .map((d) => d.file);
    expect(direct).toEqual(['b.ts', 'c.ts', 'd.ts']);
  });

  it('includes transitive dependents as inferred', () => {
    const graph = buildDepGraph(facts);
    const e = graph.dependentsOf('a.ts', 'symbolX').find((d) => d.file === 'e.ts');
    expect(e?.confidence).toBe('inferred');
    expect(e?.distance).toBe(2);
  });

  it('is deterministic across runs (same input => same output)', () => {
    const a = JSON.stringify(buildDepGraph(facts).dependentsOf('a.ts', 'symbolX'));
    const b = JSON.stringify(buildDepGraph(facts).dependentsOf('a.ts', 'symbolX'));
    expect(a).toBe(b);
  });

  it('invents nothing — unrelated files never appear', () => {
    const graph = buildDepGraph(facts);
    const files = graph.dependentsOf('a.ts', 'symbolX').map((d) => d.file);
    expect(files).not.toContain('unrelated.ts');
    expect(files).not.toContain('somewhere.ts');
  });

  it('never includes the target itself', () => {
    const graph = buildDepGraph(facts);
    expect(graph.dependentsOf('a.ts', 'symbolX').map((d) => d.file)).not.toContain('a.ts');
  });

  it('without a symbol filter, matches any reference to the file', () => {
    const graph = buildDepGraph(facts);
    // Only b/c/d reference a.ts at all; e is transitive.
    const certain = graph
      .dependentsOf('a.ts')
      .filter((d) => d.confidence === 'certain')
      .map((d) => d.file);
    expect(certain).toEqual(['b.ts', 'c.ts', 'd.ts']);
  });
});

describe('buildDepGraph.dependenciesOf', () => {
  it('returns the direct dependencies of a file', () => {
    const graph = buildDepGraph(facts);
    expect(graph.dependenciesOf('b.ts').map((d) => d.file)).toEqual(['a.ts']);
    expect(graph.dependenciesOf('a.ts').map((d) => d.file)).toEqual(['other.ts']);
  });
});
