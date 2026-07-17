import {
  approveNode,
  driftCheck,
  handoffForNode,
  impactForNode,
  loadGraph,
  mapRepo,
  projectMarkdown,
  resolveLlmProvider,
} from '@planmap/engine';

/** Where the API reads the repo and its `.planmap` store from. */
export interface ApiContext {
  repoRoot: string;
  storeRoot: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

const json = (status: number, body: unknown): ApiResponse => ({ status, body });

/**
 * The whole web API surface as one pure function over `@planmap/engine`. It binds no
 * port and touches no `req`/`res`, so it is exercised directly in tests — the same
 * engine calls the CLI makes, which is what keeps the two surfaces honest (A5). The
 * HTTP layer is a thin adapter that just calls this and serializes the result.
 */
export async function handleApi(
  method: string,
  path: string,
  ctx: ApiContext,
): Promise<ApiResponse> {
  const segments = path
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean);
  const [resource, rawId] = segments;
  const id = rawId ? decodeURIComponent(rawId) : undefined;
  const llm = resolveLlmProvider();

  try {
    if (method === 'GET' && resource === 'graph') {
      return json(200, await loadGraph(ctx.storeRoot));
    }
    if (method === 'GET' && resource === 'impact' && id) {
      return json(200, await impactForNode(id, ctx.repoRoot, ctx.storeRoot, llm));
    }
    if (method === 'POST' && resource === 'approve' && id) {
      await approveNode(id, ctx.storeRoot);
      return json(200, { ok: true, id });
    }
    if (method === 'GET' && resource === 'drift') {
      return json(200, await driftCheck(ctx.repoRoot, ctx.storeRoot, llm));
    }
    if (method === 'GET' && resource === 'handoff' && id) {
      return json(200, { instruction: await handoffForNode(id, ctx.repoRoot, ctx.storeRoot, llm) });
    }
    if (method === 'GET' && resource === 'projection') {
      return json(200, { markdown: await projectMarkdown(ctx.storeRoot) });
    }
    if (method === 'POST' && resource === 'map') {
      return json(200, await mapRepo(ctx.repoRoot, ctx.storeRoot));
    }
    return json(404, { error: `No route for ${method} ${path}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A missing node is a client error; anything else is a genuine failure.
    return json(/not found/i.test(message) ? 404 : 500, { error: message });
  }
}
