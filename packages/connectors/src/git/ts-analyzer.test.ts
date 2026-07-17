import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { analyzeTypeScriptRepo } from './ts-analyzer';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', '..', 'test-fixtures', 'mini');

describe('analyzeTypeScriptRepo', () => {
  const structure = analyzeTypeScriptRepo(fixture);

  it('derives feature / module / element units from real code (no manual entry)', () => {
    expect(structure.units.some((u) => u.kind === 'feature' && u.title === 'auth')).toBe(true);
    const verify = structure.units.find((u) => u.symbol === 'verifyToken');
    expect(verify?.kind).toBe('element');
    expect(verify?.file).toBe('src/auth/jwt.ts');
    expect(verify?.hash).toBeTruthy();
    expect(verify?.range?.[0]).toBeGreaterThan(0);
    expect(verify?.lensTags).toContain('security');
  });

  it('extracts the import fact (login imports jwt)', () => {
    const imp = structure.facts.edges.find(
      (e) =>
        e.kind === 'import' && e.fromFile === 'src/auth/login.ts' && e.toFile === 'src/auth/jwt.ts',
    );
    expect(imp).toBeDefined();
  });

  it('extracts the cross-file call fact (login calls verifyToken)', () => {
    const call = structure.facts.edges.find(
      (e) =>
        e.kind === 'call' &&
        e.toFile === 'src/auth/jwt.ts' &&
        e.toSymbol === 'verifyToken' &&
        e.fromFile === 'src/auth/login.ts',
    );
    expect(call).toBeDefined();
    expect(call?.fromSymbol).toBe('login');
  });

  it('does not fabricate edges to unreferenced files', () => {
    const toLog = structure.facts.edges.filter((e) => e.toFile === 'src/util/log.ts');
    expect(toLog).toHaveLength(0);
  });
});
