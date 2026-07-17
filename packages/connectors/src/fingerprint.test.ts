import { describe, expect, it } from 'vitest';

import { fingerprintRange, normalizeAndHash } from './fingerprint';

describe('normalizeAndHash', () => {
  it('is stable and whitespace-insensitive', () => {
    expect(normalizeAndHash('a   b')).toBe(normalizeAndHash('a b'));
    expect(normalizeAndHash('a\n\tb')).toBe(normalizeAndHash('a b'));
  });

  it('differs on a real content change', () => {
    expect(normalizeAndHash('return 30')).not.toBe(normalizeAndHash('return 24'));
  });
});

describe('fingerprintRange', () => {
  it('hashes the given 1-based inclusive line range', () => {
    const content = ['line1', 'line2', 'line3', 'line4'].join('\n');
    expect(fingerprintRange(content, [2, 3])).toBe(normalizeAndHash('line2\nline3'));
  });
});
