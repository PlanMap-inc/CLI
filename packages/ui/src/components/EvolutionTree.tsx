import { useMemo, useState } from 'react';

import type { EvoNode } from '../model';
import { StatusBadge, StatusDot } from './Status';

/** Keep a subtree only if it (or a descendant) carries the active tag. */
function pruneByTag(node: EvoNode, tag: string): EvoNode | null {
  if (tag === 'all') return node;
  const children = node.children
    .map((child) => pruneByTag(child, tag))
    .filter((c): c is EvoNode => c !== null);
  if (node.tags.includes(tag) || children.length > 0) return { ...node, children };
  return null;
}

interface RowProps {
  node: EvoNode;
  depth: number;
  selectedId?: string;
  forceOpen: boolean;
  onSelect: (node: EvoNode) => void;
}

function TreeRow({ node, depth, selectedId, forceOpen, onSelect }: RowProps): JSX.Element {
  const hasKids = node.children.length > 0;
  // Deep branches start collapsed so the tree opens legible, not as a wall.
  const [open, setOpen] = useState(depth < 2);
  const expanded = forceOpen || open;
  const isDrift = node.status === 'drifted' || node.status === 'error';

  return (
    <div className="pm-evo-node">
      <div
        className={`pm-evo-row${node.id === selectedId ? ' is-selected' : ''}`}
        data-drift={isDrift ? 'true' : undefined}
        role="treeitem"
        aria-selected={node.id === selectedId}
        aria-expanded={hasKids ? expanded : undefined}
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node);
          }
        }}
      >
        <button
          type="button"
          className={`pm-evo-toggle${hasKids ? '' : ' is-leaf'}`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            if (hasKids) setOpen((v) => !v);
          }}
        >
          {hasKids ? (expanded ? '▾' : '▸') : ''}
        </button>
        <StatusDot status={node.status} />
        <span className="pm-evo-title">{node.title}</span>
        <span className="pm-evo-tags">
          {node.tags.map((tag) => (
            <span className="pm-tag-dot" data-tag={tag} title={tag} key={tag} />
          ))}
        </span>
      </div>
      {hasKids && expanded ? (
        <div className="pm-evo-children" role="group">
          {node.children.map((child) => (
            <TreeRow
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              forceOpen={forceOpen}
              onSelect={onSelect}
              key={child.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface EvolutionTreeProps {
  root: EvoNode;
  selectedId?: string;
  filterTag?: string;
  onSelect: (node: EvoNode) => void;
}

/**
 * The read-only Evolution tree — what actually exists, derived from code. It is
 * never hand-authored, so it cannot rot into a stale catalog. Tag filtering forces
 * matching branches open so a filtered view is never hidden behind a collapsed row.
 */
export function EvolutionTree({
  root,
  selectedId,
  filterTag = 'all',
  onSelect,
}: EvolutionTreeProps): JSX.Element {
  const filtered = useMemo(() => pruneByTag(root, filterTag), [root, filterTag]);
  const forceOpen = filterTag !== 'all';

  return (
    <div className="pm-evo-tree" role="tree" aria-label="Evolution graph">
      <div className="pm-evo-root">{root.title}</div>
      {filtered && filtered.children.length > 0 ? (
        filtered.children.map((child) => (
          <TreeRow
            node={child}
            depth={0}
            selectedId={selectedId}
            forceOpen={forceOpen}
            onSelect={onSelect}
            key={child.id}
          />
        ))
      ) : (
        <p className="pm-empty">Nothing tagged “{filterTag}”.</p>
      )}
    </div>
  );
}

interface EvoNodeDetailProps {
  node: EvoNode;
  onClose?: () => void;
}

/**
 * Detail for one Evolution node. When the node drifted, the callout is the loud
 * moment: it states what diverged and why the node reads as drift, while keeping
 * the original annotation (the *why* the change was made) intact beside it — the
 * behavioral moat the product is built to accumulate.
 */
export function EvoNodeDetail({ node, onClose }: EvoNodeDetailProps): JSX.Element {
  const d = node.detail ?? {};
  const isError = node.status === 'error';
  return (
    <section className="pm-panel pm-evo-detail" aria-label={`Evolution node: ${node.title}`}>
      <header className="pm-panel-head">
        <h3 className="pm-panel-title">{node.title}</h3>
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
      <div className="pm-panel-eyebrow">
        Evolution node · <StatusBadge status={node.status} />
      </div>

      <div className="pm-section">
        <div className="pm-section-h">Tags</div>
        <div className="pm-badge-row">
          {node.tags.length > 0 ? (
            node.tags.map((tag) => (
              <span className="pm-badge pm-flag" data-flag={tag} key={tag}>
                {tag}
              </span>
            ))
          ) : (
            <span className="pm-badge">untagged</span>
          )}
        </div>
      </div>

      {d.prompt ? (
        <div className="pm-section">
          <div className="pm-section-h">Original prompt</div>
          <p className="pm-prose">“{d.prompt}”</p>
        </div>
      ) : null}

      <div className="pm-section">
        <div className="pm-section-h">Summary</div>
        <p className="pm-prose">
          {d.summary ?? 'Implemented as part of this feature. No further detail recorded yet.'}
        </p>
      </div>

      {d.files && d.files.length > 0 ? (
        <div className="pm-section">
          <div className="pm-section-h">Linked code</div>
          <ul className="pm-affected-list">
            {d.files.map((file) => (
              <li className="pm-affected" key={`${file.path}:${file.range ?? ''}`}>
                <div className="pm-affected-head">
                  <code className="pm-path">{file.path}</code>
                  {file.range ? <span className="pm-range">{file.range}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.drift ? (
        <div className="pm-section">
          <div className="pm-section-h">{isError ? 'Error' : 'Drift'}</div>
          <div className="pm-drift-callout" data-kind={isError ? 'error' : 'drifted'} role="alert">
            <div className="pm-drift-h">{isError ? 'Error' : 'Drifted'}</div>
            <p className="pm-prose">{d.drift.issue}</p>
            {d.drift.cause ? <p className="pm-drift-cause">{d.drift.cause}</p> : null}
          </div>
        </div>
      ) : null}

      {d.annotation ? (
        <div className="pm-section">
          <div className="pm-section-h">Annotation — the why</div>
          <p className="pm-prose">{d.annotation}</p>
        </div>
      ) : null}
    </section>
  );
}
