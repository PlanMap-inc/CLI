import { describe, expect, it, vi } from 'vitest';

import { buildDepGraph } from '../depgraph';
import type { DepFacts } from '../depgraph';
import type { LLMProvider } from '../llm';
import type { Node } from '../model';

import { analyzeImpact } from './analyze';

function makeNode(over: Partial<Node> & Pick<Node, 'id' | 'title'>): Node {
  const base: Node = {
    id: over.id,
    graph: 'plan',
    level: 'feature_space',
    type: 'step',
    title: over.title,
    status: 'approved',
    origin: 'ai_generated',
    parent: null,
    edges_out: [],
    lens_tags: [],
    linked_code: [],
    depends_on: [],
    depended_on_by: [],
    created_at: '2026-01-01T00:00:00Z',
  };
  return { ...base, ...over };
}

// authService.ts#verifyToken is called by three controllers; a UI file is unrelated.
const facts: DepFacts = {
  files: [
    'src/auth/authService.ts',
    'src/auth/loginController.ts',
    'src/auth/resetController.ts',
    'src/auth/sessionMiddleware.ts',
    'src/ui/Button.ts',
    'src/ui/styles.ts',
  ],
  edges: [
    {
      fromFile: 'src/auth/loginController.ts',
      fromSymbol: 'login',
      toFile: 'src/auth/authService.ts',
      toSymbol: 'verifyToken',
      kind: 'call',
    },
    {
      fromFile: 'src/auth/resetController.ts',
      fromSymbol: 'reset',
      toFile: 'src/auth/authService.ts',
      toSymbol: 'verifyToken',
      kind: 'call',
    },
    {
      fromFile: 'src/auth/sessionMiddleware.ts',
      fromSymbol: 'mw',
      toFile: 'src/auth/authService.ts',
      toSymbol: 'verifyToken',
      kind: 'call',
    },
    {
      fromFile: 'src/ui/Button.ts',
      fromSymbol: 'render',
      toFile: 'src/ui/styles.ts',
      toSymbol: 'theme',
      kind: 'import',
    },
  ],
};

const graph = buildDepGraph(facts);
const edited = makeNode({
  id: 'node_auth',
  title: 'Verify auth token',
  linked_code: [{ path: 'src/auth/authService.ts', range: [1, 50], hash: 'h' }],
  depends_on: ['node_db'],
  depended_on_by: ['node_login'],
});
const targets = [{ file: 'src/auth/authService.ts', symbol: 'verifyToken' }];

describe('analyzeImpact', () => {
  it('returns exactly the parser-found dependents (WHAT), no LLM required', async () => {
    const result = await analyzeImpact({ editedNode: edited, targets, depgraph: graph });
    expect(result.affected.map((a) => a.path)).toEqual([
      'src/auth/loginController.ts',
      'src/auth/resetController.ts',
      'src/auth/sessionMiddleware.ts',
    ]);
    expect(result.affected.every((a) => a.confidence === 'certain')).toBe(true);
    expect(result.affected.every((a) => a.why === null)).toBe(true);
  });

  it('invents nothing — unrelated files never appear', async () => {
    const result = await analyzeImpact({ editedNode: edited, targets, depgraph: graph });
    const files = result.affected.map((a) => a.path);
    expect(files).not.toContain('src/ui/Button.ts');
    expect(files).not.toContain('src/ui/styles.ts');
  });

  it('is deterministic across runs', async () => {
    const a = await analyzeImpact({ editedNode: edited, targets, depgraph: graph });
    const b = await analyzeImpact({ editedNode: edited, targets, depgraph: graph });
    expect(JSON.stringify(a.affected)).toBe(JSON.stringify(b.affected));
  });

  it('flags auth risk from the touched code path', async () => {
    const result = await analyzeImpact({ editedNode: edited, targets, depgraph: graph });
    expect(result.riskFlags).toContain('auth');
  });

  it('surfaces the node dependency rollups', async () => {
    const result = await analyzeImpact({ editedNode: edited, targets, depgraph: graph });
    expect(result.dependencies.depends_on).toEqual(['node_db']);
    expect(result.dependencies.depended_on_by).toEqual(['node_login']);
  });

  it('LLM adds WHY without changing WHAT', async () => {
    const complete = vi.fn(async () => 'because it calls verifyToken()');
    const llm: LLMProvider = { complete };
    const withLlm = await analyzeImpact({ editedNode: edited, targets, depgraph: graph, llm });
    const withoutLlm = await analyzeImpact({ editedNode: edited, targets, depgraph: graph });
    expect(withLlm.affected.map((a) => a.path)).toEqual(withoutLlm.affected.map((a) => a.path));
    expect(withLlm.affected.every((a) => a.why === 'because it calls verifyToken()')).toBe(true);
    expect(complete).toHaveBeenCalledTimes(3);
  });

  it('a provider failure never breaks the WHAT (why falls back to null)', async () => {
    const llm: LLMProvider = {
      complete: async () => {
        throw new Error('network down');
      },
    };
    const result = await analyzeImpact({ editedNode: edited, targets, depgraph: graph, llm });
    expect(result.affected).toHaveLength(3);
    expect(result.affected.every((a) => a.why === null)).toBe(true);
  });

  it('maps affected files to nodes when a reverse index is provided', async () => {
    const loginNode = makeNode({ id: 'node_login_ctrl', title: 'Login controller' });
    const nodesForFile = (f: string): Node[] =>
      f === 'src/auth/loginController.ts' ? [loginNode] : [];
    const result = await analyzeImpact({
      editedNode: edited,
      targets,
      depgraph: graph,
      nodesForFile,
    });
    const login = result.affected.find((a) => a.path === 'src/auth/loginController.ts');
    expect(login?.nodeId).toBe('node_login_ctrl');
    expect(login?.kind).toBe('node');
  });
});
