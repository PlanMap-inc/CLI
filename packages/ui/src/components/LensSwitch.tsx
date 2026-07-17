import type { Lens } from '../model';

interface LensDef {
  key: Lens;
  label: string;
}

/** The four registers a feature can be read in. Order is deliberate: outward-in. */
export const LENSES: readonly LensDef[] = [
  { key: 'business', label: 'Business' },
  { key: 'backend', label: 'Backend' },
  { key: 'security', label: 'Security' },
  { key: 'database', label: 'Database' },
] as const;

interface LensSwitchProps {
  value: Lens;
  onChange: (lens: Lens) => void;
}

/** Segmented control for switching the Feature-Space lens. Each lens owns a swatch color. */
export function LensSwitch({ value, onChange }: LensSwitchProps): JSX.Element {
  return (
    <div className="pm-lens-switch" role="tablist" aria-label="Lens">
      {LENSES.map((lens) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === lens.key}
          className={`pm-lens-btn${value === lens.key ? ' is-active' : ''}`}
          data-lens={lens.key}
          onClick={() => onChange(lens.key)}
          key={lens.key}
        >
          <span className="pm-lens-swatch" data-lens={lens.key} />
          {lens.label}
        </button>
      ))}
    </div>
  );
}
