import type { CSSProperties } from 'react';

import { PLAN_STATUSES, type PlanStatus } from '../model';

/** Human labels for the status vocabulary; kept here so every surface agrees. */
export const STATUS_LABEL: Record<PlanStatus, string> = {
  intended: 'intended',
  approved: 'approved',
  implemented: 'implemented',
  drifted: 'drifted',
  error: 'error',
};

interface StatusDotProps {
  status: PlanStatus;
  /** Accent used when a node is `implemented` (its feature/lens color). */
  color?: string;
  title?: string;
}

/**
 * The single source of truth for how a status looks. The shape itself carries
 * meaning: `intended` is a dashed outline (planned, not real), `approved` a solid
 * outline (a baseline), `implemented` a filled accent (real), and `drifted`/`error`
 * a filled danger dot with a halo — the loud note.
 */
export function StatusDot({ status, color, title }: StatusDotProps): JSX.Element {
  const style: CSSProperties = status === 'implemented' && color ? { background: color } : {};
  return (
    <span
      className="pm-status-dot"
      data-status={status}
      style={style}
      title={title ?? STATUS_LABEL[status]}
      aria-hidden="true"
    />
  );
}

interface StatusBadgeProps {
  status: PlanStatus;
  color?: string;
}

/** A status dot with its mono label — used in node detail headers and pills. */
export function StatusBadge({ status, color }: StatusBadgeProps): JSX.Element {
  return (
    <span className="pm-status-badge" data-status={status}>
      <StatusDot status={status} color={color} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The legend that anchors the status vocabulary in the status bar. Reads out every
 * state so a first-time user learns the language of the map at a glance.
 */
export function StatusLegend(): JSX.Element {
  return (
    <div className="pm-legend" role="list" aria-label="Status legend">
      {PLAN_STATUSES.map((status) => (
        <span className="pm-legend-item" role="listitem" key={status}>
          <StatusDot status={status} />
          {STATUS_LABEL[status]}
        </span>
      ))}
    </div>
  );
}
