import { describe, expect, it } from 'vitest';

import type { ImpactResult } from '../impact';
import { makeNode } from '../testing';

import { composeHandoff } from './handoff';

describe('composeHandoff', () => {
  const node = makeNode({
    id: 'n',
    title: 'Rate-limit reset attempts',
    intent: 'Max 5 reset requests per email per hour.',
    annotation: 'Per-email not per-IP — shared NAT in target market.',
    linked_code: [{ path: 'src/auth/reset.ts', range: [42, 78], hash: 'h' }],
  });

  it('includes the task, intent, why, and a bounded file scope', () => {
    const out = composeHandoff(node);
    expect(out).toContain('# Task: Rate-limit reset attempts');
    expect(out).toContain('Max 5 reset requests');
    expect(out).toContain('Per-email not per-IP');
    expect(out).toContain('- src/auth/reset.ts');
    expect(out).toContain('modify only these files');
  });

  it('folds impact-affected files into the scope and surfaces risk', () => {
    const impact: ImpactResult = {
      editedNode: 'n',
      affected: [{ path: 'src/auth/session.ts', kind: 'file', confidence: 'certain', why: null }],
      dependencies: { depends_on: [], depended_on_by: [] },
      riskFlags: ['auth'],
    };
    const out = composeHandoff(node, impact);
    expect(out).toContain('- src/auth/session.ts');
    expect(out).toContain('**Risk:** auth');
  });

  it('never emits code (PlanMap decides, the agent writes)', () => {
    expect(composeHandoff(node)).not.toContain('```');
  });
});
