import { describe, expect, it } from 'vitest';

import type { Connector } from './connector';
import type { LLMProvider } from './llm';
import type { StorageAdapter } from './store';

/**
 * These tests pin the seam *contracts*: a stub implementation must satisfy the
 * interface (compile-time), and the runtime shape must behave. The real
 * implementations live in @planmap/db (StorageAdapter), @planmap/connectors
 * (Connector), and the LLM providers.
 */

describe('LLMProvider seam', () => {
  const stub: LLMProvider = {
    async complete(prompt) {
      return `echo:${prompt}`;
    },
  };

  it('is implementable and callable, and stream is optional', async () => {
    expect(await stub.complete('hi')).toBe('echo:hi');
    expect(stub.stream).toBeUndefined();
  });
});

describe('Connector seam', () => {
  const stub: Connector = {
    id: 'stub',
    capabilities: ['code'],
    async *discover() {
      return;
    },
    async read(resource) {
      return { resource, content: '' };
    },
    fingerprint() {
      return 'h';
    },
  };

  it('has a stable id, declared capabilities, and a fingerprint', async () => {
    expect(stub.id).toBe('stub');
    expect(stub.capabilities).toContain('code');
    expect(stub.fingerprint({ resource: { id: 'x', kind: 'file' }, content: '' })).toBe('h');
    const found: string[] = [];
    for await (const r of stub.discover({ root: '.' })) found.push(r.id);
    expect(found).toEqual([]);
  });
});

describe('StorageAdapter seam', () => {
  it('is importable as a type contract', () => {
    // Compile-time contract only; the concrete impl + behavior live in @planmap/db.
    const unset = undefined as unknown as StorageAdapter;
    expect(unset).toBeUndefined();
  });
});
