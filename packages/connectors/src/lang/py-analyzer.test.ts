import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { analyzePythonRepo } from './py-analyzer';

const here = dirname(fileURLToPath(import.meta.url));
const samplePy = join(here, '..', '..', '..', '..', 'examples', 'sample-py');

describe('analyzePythonRepo (tree-sitter, WASM)', () => {
  it('extracts modules and top-level defs as units', async () => {
    const { units } = await analyzePythonRepo(samplePy);
    const elements = units.filter((u) => u.kind === 'element').map((u) => u.symbol);
    expect(elements).toContain('verify_token');
    expect(elements).toContain('issue_token');
    expect(elements).toContain('login');
    expect(elements).toContain('checkout');

    const verify = units.find((u) => u.id === 'element:auth/tokens.py#verify_token');
    expect(verify?.file).toBe('auth/tokens.py');
    expect(verify?.lensTags).toContain('security');
    expect(verify?.range?.[0]).toBeGreaterThan(0);
  });

  it('names exactly the callers of verify_token, as inferred edges', async () => {
    const { facts } = await analyzePythonRepo(samplePy);
    const callers = facts.edges
      .filter((e) => e.kind === 'call' && e.toSymbol === 'verify_token')
      .map((e) => e.fromFile);
    expect(callers).toContain('auth/login.py');
    expect(callers).toContain('billing/checkout.py');
    // browse is unrelated — never invented as a dependency.
    expect(callers).not.toContain('catalog/browse.py');

    for (const edge of facts.edges.filter((e) => e.kind === 'call')) {
      expect(edge.confidence).toBe('inferred');
    }
  });

  it('resolves imports by path as certain facts', async () => {
    const { facts } = await analyzePythonRepo(samplePy);
    const imports = facts.edges.filter((e) => e.kind === 'import');
    expect(imports).toContainEqual(
      expect.objectContaining({
        fromFile: 'auth/login.py',
        toFile: 'auth/tokens.py',
        kind: 'import',
        confidence: 'certain',
      }),
    );
  });

  it('returns empty for a repo with no Python files', async () => {
    const result = await analyzePythonRepo(here); // this dir has .ts, no .py
    expect(result.units).toHaveLength(0);
    expect(result.facts.files).toHaveLength(0);
  });
});
