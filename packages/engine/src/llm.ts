import type { LLMProvider } from '@planmap/core';

/**
 * Resolve an optional LLM provider. M1 keeps the LLM optional/stubbed: with no
 * key configured this returns `undefined`, and the engine still produces the
 * full, correct WHAT — only the plain-language WHY is absent. The real Anthropic
 * and Amazon Bedrock providers (BYO-key, never metered) plug in here as a
 * fast-follow; keeping them out of `@planmap/core` preserves its zero-I/O purity.
 */
export function resolveLlmProvider(): LLMProvider | undefined {
  return undefined;
}
