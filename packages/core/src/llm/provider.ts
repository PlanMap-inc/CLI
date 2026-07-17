export interface CompleteOpts {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * The LLM seam. BYO-key, never metered. In Impact Analysis and Drift the
 * provider is only ever a *narrator* — it explains WHY in plain language and
 * never decides WHAT is affected. It is optional at runtime: the engine returns
 * correct, deterministic facts even when no provider is configured (the WHY is
 * simply absent).
 */
export interface LLMProvider {
  complete(prompt: string, opts?: CompleteOpts): Promise<string>;
  stream?(prompt: string, opts?: CompleteOpts): AsyncIterable<string>;
}
