import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LENSES, LensSwitch } from './LensSwitch';

describe('LensSwitch', () => {
  it('renders every lens', () => {
    render(<LensSwitch value="business" onChange={() => {}} />);
    for (const lens of LENSES) {
      expect(screen.getByText(lens.label)).toBeTruthy();
    }
  });

  it('marks the active lens as the selected tab', () => {
    render(<LensSwitch value="security" onChange={() => {}} />);
    const active = screen.getByRole('tab', { selected: true });
    expect(active.textContent).toContain('Security');
  });

  it('emits the chosen lens on click', () => {
    const onChange = vi.fn();
    render(<LensSwitch value="business" onChange={onChange} />);
    fireEvent.click(screen.getByText('Backend'));
    expect(onChange).toHaveBeenCalledWith('backend');
  });
});
