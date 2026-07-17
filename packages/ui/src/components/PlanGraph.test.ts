import { describe, expect, it } from 'vitest';

import type { PlanGraphView } from '../model';
import { planGraphToFlow } from './PlanGraph';

const view: PlanGraphView = {
  nodes: [
    {
      id: 'a',
      title: 'Login',
      sub: '8 nodes',
      status: 'implemented',
      color: 'orange',
      x: 10,
      y: 20,
    },
    { id: 'b', title: 'Cart', status: 'intended', x: 30, y: 40 },
  ],
  edges: [{ id: 'a->b', from: 'a', to: 'b' }],
};

describe('planGraphToFlow', () => {
  it('maps view-model coordinates onto React Flow positions', () => {
    const { nodes } = planGraphToFlow(view);
    expect(nodes[0]?.position).toEqual({ x: 10, y: 20 });
    expect(nodes[1]?.position).toEqual({ x: 30, y: 40 });
  });

  it('carries the node payload through as data', () => {
    const { nodes } = planGraphToFlow(view);
    expect(nodes[0]?.data).toEqual({
      title: 'Login',
      sub: '8 nodes',
      status: 'implemented',
      color: 'orange',
    });
    expect(nodes[0]?.type).toBe('plan');
  });

  it('marks exactly the selected node as selected', () => {
    const { nodes } = planGraphToFlow(view, 'b');
    expect(nodes.find((n) => n.id === 'a')?.selected).toBe(false);
    expect(nodes.find((n) => n.id === 'b')?.selected).toBe(true);
  });

  it('maps edges from/to onto source/target', () => {
    const { edges } = planGraphToFlow(view);
    expect(edges[0]).toMatchObject({ id: 'a->b', source: 'a', target: 'b' });
  });
});
