import type { ReactNode } from 'react';

export interface RailItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Disabled items read as "coming later" (e.g. Chat is roadmap in M1). */
  disabled?: boolean;
}

interface IconRailProps {
  items: RailItem[];
  active: string;
  onSelect: (key: string) => void;
}

/** The left navigation rail — the app's primary view switch. */
export function IconRail({ items, active, onSelect }: IconRailProps): JSX.Element {
  return (
    <nav className="pm-rail" aria-label="Primary">
      <div className="pm-rail-mark" aria-hidden="true" />
      {items.map((item) => (
        <button
          type="button"
          key={item.key}
          className={`pm-rail-btn${item.key === active ? ' is-active' : ''}`}
          aria-label={item.label}
          aria-current={item.key === active ? 'page' : undefined}
          title={item.disabled ? `${item.label} — coming soon` : item.label}
          disabled={item.disabled}
          onClick={() => onSelect(item.key)}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}
