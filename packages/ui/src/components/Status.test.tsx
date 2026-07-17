import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PLAN_STATUSES } from '../model';
import { StatusBadge, StatusDot, StatusLegend } from './Status';

describe('StatusDot', () => {
  it('encodes the status as a data attribute so CSS can style each state', () => {
    const { container } = render(<StatusDot status="drifted" />);
    const dot = container.querySelector('.pm-status-dot');
    expect(dot?.getAttribute('data-status')).toBe('drifted');
  });

  it('applies the accent color only when implemented', () => {
    const { container } = render(<StatusDot status="implemented" color="rgb(1, 2, 3)" />);
    const dot = container.querySelector('.pm-status-dot') as HTMLElement;
    expect(dot.style.background).toBe('rgb(1, 2, 3)');
  });

  it('ignores the accent color for non-implemented states', () => {
    const { container } = render(<StatusDot status="intended" color="rgb(1, 2, 3)" />);
    const dot = container.querySelector('.pm-status-dot') as HTMLElement;
    expect(dot.style.background).toBe('');
  });
});

describe('StatusBadge', () => {
  it('shows the status label', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('approved')).toBeTruthy();
  });
});

describe('StatusLegend', () => {
  it('lists every status in the vocabulary', () => {
    render(<StatusLegend />);
    for (const status of PLAN_STATUSES) {
      expect(screen.getByText(status)).toBeTruthy();
    }
  });
});
