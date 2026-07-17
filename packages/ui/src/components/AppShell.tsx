import type { ReactNode } from 'react';

interface AppShellProps {
  /** The left navigation rail (usually an <IconRail />). */
  rail: ReactNode;
  /** The toolbar row above the workspace (breadcrumb, lens switch, controls). */
  header?: ReactNode;
  /** The status bar below the workspace (legend + hint). */
  footer?: ReactNode;
  /** The right detail drawer (Impact / Evolution detail), or null when closed. */
  aside?: ReactNode;
  /** The main canvas area. */
  children: ReactNode;
}

/**
 * The application frame: an IDE-style shell of rail · (header / workspace / footer),
 * with an optional right drawer. It owns the `.planmap-root` scope so design tokens
 * apply, and it is layout-only — every region is a slot the host app fills, which
 * keeps the same frame reusable by the web app and the later VS Code webview.
 */
export function AppShell({ rail, header, footer, aside, children }: AppShellProps): JSX.Element {
  return (
    <div className="planmap-root pm-shell">
      {rail}
      <div className="pm-main">
        {header}
        <div className="pm-workspace">
          <div className="pm-canvas-area">{children}</div>
          {aside ? <aside className="pm-drawer">{aside}</aside> : null}
        </div>
        {footer}
      </div>
    </div>
  );
}
