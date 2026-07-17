import type { Confidence, ImpactAffected, ImpactView, Provenance, Risk } from '../model';

const PROVENANCE_LABEL: Record<Provenance, string> = {
  parser: 'parser',
  llm: 'llm',
  unsure: 'unsure',
};

const RISK_LABEL: Record<Risk, string> = { low: 'low', medium: 'medium', high: 'high' };

function AffectedRow({ site }: { site: ImpactAffected }): JSX.Element {
  return (
    <li className="pm-affected">
      <div className="pm-affected-head">
        <code className="pm-path">{site.path}</code>
        {site.range ? <span className="pm-range">{site.range}</span> : null}
        <span className="pm-prov" data-prov={site.provenance} title={`source: ${site.provenance}`}>
          {PROVENANCE_LABEL[site.provenance]}
        </span>
      </div>
      {site.why ? (
        <p className="pm-why">{site.why}</p>
      ) : (
        <p className="pm-why pm-why-absent">
          No narration — the affected site is a static-analysis fact.
        </p>
      )}
    </li>
  );
}

interface ImpactPanelProps {
  impact: ImpactView;
  onClose?: () => void;
}

/**
 * The Impact Analysis read-out. The parser decides *what* is affected (the file
 * list is factual); the optional LLM only narrates *why*. Confidence and per-site
 * provenance are always visible, so a user can trust the "what" even when the
 * "why" is absent — the credibility the product is built on.
 */
export function ImpactPanel({ impact, onClose }: ImpactPanelProps): JSX.Element {
  const confidence: Confidence = impact.confidence;
  return (
    <section className="pm-panel pm-impact" aria-label={`Impact analysis: ${impact.title}`}>
      <header className="pm-panel-head">
        <h3 className="pm-panel-title">{impact.title}</h3>
        {onClose ? (
          <button
            type="button"
            className="pm-panel-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        ) : null}
      </header>
      <div className="pm-panel-eyebrow">Impact analysis</div>

      <div className="pm-section">
        <div className="pm-section-h">
          Affected <span className="pm-count">{impact.affected.length}</span>
        </div>
        {impact.affected.length === 0 ? (
          <p className="pm-empty">No static callers found. This node has no linked code yet.</p>
        ) : (
          <ul className="pm-affected-list">
            {impact.affected.map((site) => (
              <AffectedRow site={site} key={`${site.path}:${site.range ?? ''}`} />
            ))}
          </ul>
        )}
      </div>

      {impact.dependencies ? (
        <div className="pm-section">
          <div className="pm-section-h">Dependencies</div>
          <p className="pm-prose">{impact.dependencies}</p>
        </div>
      ) : null}

      <div className="pm-section">
        <div className="pm-section-h">Risk · Confidence</div>
        <div className="pm-badge-row">
          <span className="pm-badge" data-risk={impact.risk}>
            ⬤ {RISK_LABEL[impact.risk]} risk
          </span>
          <span className="pm-badge" data-confidence={confidence}>
            ◈ {confidence} confidence
          </span>
        </div>
      </div>

      {impact.riskFlags && impact.riskFlags.length > 0 ? (
        <div className="pm-section">
          <div className="pm-section-h">Flags</div>
          <div className="pm-badge-row">
            {impact.riskFlags.map((flag) => (
              <span className="pm-badge pm-flag" data-flag={flag} key={flag}>
                {flag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
