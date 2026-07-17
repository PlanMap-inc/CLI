import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { EvoNode } from '../model';
import { EvoNodeDetail, EvolutionTree } from './EvolutionTree';

const tree: EvoNode = {
  id: 'root',
  title: 'Sample App',
  status: 'implemented',
  tags: [],
  children: [
    {
      id: 'login',
      title: 'Login',
      status: 'implemented',
      tags: [],
      children: [
        {
          id: 'jwt',
          title: 'Added JWT auth',
          status: 'implemented',
          tags: ['security'],
          children: [],
        },
        {
          id: 'remember',
          title: 'Added remember me',
          status: 'drifted',
          tags: ['frontend'],
          children: [],
        },
      ],
    },
    {
      id: 'cart',
      title: 'Cart',
      status: 'implemented',
      tags: [],
      children: [{ id: 'promo', title: 'Promo code', status: 'intended', tags: [], children: [] }],
    },
  ],
};

describe('EvolutionTree', () => {
  it('renders the tree from the root down', () => {
    render(<EvolutionTree root={tree} onSelect={() => {}} />);
    expect(screen.getByText('Sample App')).toBeTruthy();
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Cart')).toBeTruthy();
  });

  it('calls onSelect with the clicked node', () => {
    const onSelect = vi.fn();
    render(<EvolutionTree root={tree} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Login'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'login' }));
  });

  it('filters to branches carrying the active tag', () => {
    render(<EvolutionTree root={tree} filterTag="security" onSelect={() => {}} />);
    // Login stays (a descendant is tagged security); Cart is dropped entirely.
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Added JWT auth')).toBeTruthy();
    expect(screen.queryByText('Cart')).toBeNull();
  });

  it('shows an empty state when nothing matches the tag', () => {
    render(<EvolutionTree root={tree} filterTag="database" onSelect={() => {}} />);
    expect(screen.getByText(/nothing tagged/i)).toBeTruthy();
  });
});

describe('EvoNodeDetail', () => {
  const drifted: EvoNode = {
    id: 'remember',
    title: 'Added remember me',
    status: 'drifted',
    tags: ['frontend'],
    children: [],
    detail: {
      prompt: 'Add a remember me checkbox',
      summary: 'Extends the session to 30 days when checked.',
      files: [{ path: 'src/auth/login.ts', range: '42–78' }],
      annotation: '30-day window chosen deliberately — repeat orders are weekly.',
      drift: {
        issue: 'Session lifetime is hardcoded to 24h; the 30-day extension no longer exists.',
        cause: 'Modified outside PlanMap — no approved plan node corresponds to this change.',
      },
    },
  };

  it('raises a drift callout that preserves the original annotation', () => {
    const { container } = render(<EvoNodeDetail node={drifted} />);
    expect(container.querySelector('.pm-drift-callout[data-kind="drifted"]')).toBeTruthy();
    expect(screen.getByText(/no longer exists/i)).toBeTruthy();
    // The "why" annotation survives beside the drift — the behavioral moat.
    expect(screen.getByText(/repeat orders are weekly/i)).toBeTruthy();
  });

  it('labels an error node distinctly from a drifted one', () => {
    const errored: EvoNode = {
      ...drifted,
      status: 'error',
      detail: { drift: { issue: 'Linked code is missing.' } },
    };
    const { container } = render(<EvoNodeDetail node={errored} />);
    expect(container.querySelector('.pm-drift-callout[data-kind="error"]')).toBeTruthy();
  });

  it('falls back to a neutral summary when none is recorded', () => {
    const bare: EvoNode = { id: 'x', title: 'Bare', status: 'implemented', tags: [], children: [] };
    render(<EvoNodeDetail node={bare} />);
    expect(screen.getByText(/no further detail recorded/i)).toBeTruthy();
  });
});
