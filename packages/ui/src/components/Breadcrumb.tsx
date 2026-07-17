export interface Crumb {
  id: string;
  label: string;
}

interface BreadcrumbProps {
  items: Crumb[];
  onNavigate?: (id: string) => void;
}

/**
 * The Constellation → Feature path. The last crumb is the current location; earlier
 * crumbs are clickable to zoom back out. With one crumb it reads as a plain title.
 */
export function Breadcrumb({ items, onNavigate }: BreadcrumbProps): JSX.Element {
  return (
    <nav className="pm-breadcrumb" aria-label="Breadcrumb">
      {items.map((crumb, i) => {
        const isCurrent = i === items.length - 1;
        return (
          <span className="pm-crumb-group" key={crumb.id}>
            {i > 0 ? <span className="pm-crumb-sep">›</span> : null}
            {isCurrent ? (
              <span className="pm-crumb is-current" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <button type="button" className="pm-crumb" onClick={() => onNavigate?.(crumb.id)}>
                {crumb.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
