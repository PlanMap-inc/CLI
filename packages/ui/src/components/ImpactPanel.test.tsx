import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ImpactView } from '../model';
import { ImpactPanel } from './ImpactPanel';

const impact: ImpactView = {
  title: 'verifyToken',
  affected: [
    { path: 'src/auth/login.ts', range: '12–40', why: null, provenance: 'parser' },
    {
      path: 'src/checkout/checkout.ts',
      range: '5–22',
      why: 'Checkout reads the token to authorize payment.',
      provenance: 'llm',
    },
  ],
  risk: 'high',
  confidence: 'high',
  riskFlags: ['auth'],
};

describe('ImpactPanel', () => {
  it('lists every affected file (the parser-grounded WHAT)', () => {
    render(<ImpactPanel impact={impact} />);
    expect(screen.getByText('src/auth/login.ts')).toBeTruthy();
    expect(screen.getByText('src/checkout/checkout.ts')).toBeTruthy();
  });

  it('shows the affected count', () => {
    const { container } = render(<ImpactPanel impact={impact} />);
    expect(container.querySelector('.pm-count')?.textContent).toBe('2');
  });

  it('marks provenance so a fact reads differently from LLM narration', () => {
    const { container } = render(<ImpactPanel impact={impact} />);
    const provs = Array.from(container.querySelectorAll('.pm-prov')).map((n) =>
      n.getAttribute('data-prov'),
    );
    expect(provs).toEqual(['parser', 'llm']);
  });

  it('states plainly when a site has no narration instead of inventing a why', () => {
    render(<ImpactPanel impact={impact} />);
    expect(screen.getByText(/static-analysis fact/i)).toBeTruthy();
  });

  it('surfaces risk, confidence, and domain flags', () => {
    const { container } = render(<ImpactPanel impact={impact} />);
    expect(container.querySelector('.pm-badge[data-risk="high"]')).toBeTruthy();
    expect(container.querySelector('.pm-badge[data-confidence="high"]')).toBeTruthy();
    expect(container.querySelector('.pm-flag[data-flag="auth"]')).toBeTruthy();
  });

  it('reports an empty state when nothing is affected', () => {
    render(<ImpactPanel impact={{ ...impact, affected: [] }} />);
    expect(screen.getByText(/no static callers found/i)).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = vi.fn();
    render(<ImpactPanel impact={impact} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
