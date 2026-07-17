import {
  AppShell,
  Breadcrumb,
  EvoNodeDetail,
  EvolutionTree,
  IconRail,
  ImpactPanel,
  LensSwitch,
  PlanGraph,
  StatusLegend,
  type EvoNode,
  type ImpactView,
  type Lens,
} from '@planmap/ui';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, type GraphSnapshot } from './api-client';
import { toConstellation, toEvoTree, toFeatureSpace, toImpactView } from './adapter';

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const RAIL_ITEMS = [
  { key: 'plan', label: 'Plan Graph', icon: '▦' },
  { key: 'evolution', label: 'Evolution Graph', icon: '⑂' },
  { key: 'chat', label: 'Chat', icon: '💬', disabled: true },
];

const EVO_TAGS = ['all', 'security', 'backend', 'frontend'];

export function App(): JSX.Element {
  const [nav, setNav] = useState<'plan' | 'evolution'>('plan');
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGraph(await api.graph());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const titleOf = useMemo(() => {
    const map = new Map((graph?.nodes ?? []).map((n) => [n.id, n.title]));
    return (id: string): string => map.get(id) ?? id;
  }, [graph]);

  if (loading && !graph) {
    return <Splash>Reading your code and building the map…</Splash>;
  }
  if (error) {
    return (
      <Splash tone="error">
        Could not reach the local engine.
        <br />
        <span className="pm-splash-detail">{error}</span>
        <br />
        <button type="button" className="pm-btn" onClick={() => void load()}>
          Retry
        </button>
      </Splash>
    );
  }
  if (!graph) {
    return <Splash>Nothing mapped yet.</Splash>;
  }

  const rail = (
    <IconRail items={RAIL_ITEMS} active={nav} onSelect={(k) => setNav(k as 'plan' | 'evolution')} />
  );

  return nav === 'plan' ? (
    <PlanView rail={rail} graph={graph} titleOf={titleOf} onGraphChanged={() => void load()} />
  ) : (
    <EvolutionView rail={rail} graph={graph} />
  );
}

/* --------------------------------- Plan view --------------------------------- */

interface PlanViewProps {
  rail: JSX.Element;
  graph: GraphSnapshot;
  titleOf: (id: string) => string;
  onGraphChanged: () => void;
}

function PlanView({ rail, graph, titleOf, onGraphChanged }: PlanViewProps): JSX.Element {
  const [featureId, setFeatureId] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>('business');
  const [stepId, setStepId] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactView | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const view = useMemo(
    () => (featureId ? toFeatureSpace(graph, featureId, lens) : toConstellation(graph)),
    [graph, featureId, lens],
  );

  const closePanel = (): void => {
    setStepId(null);
    setImpact(null);
    setHandoff(null);
  };

  const enterFeature = (id: string): void => {
    setFeatureId(id);
    closePanel();
  };

  const selectStep = async (id: string): Promise<void> => {
    setStepId(id);
    setHandoff(null);
    setImpact(null);
    try {
      setImpact(toImpactView(await api.impact(id), titleOf(id)));
    } catch {
      setImpact(null);
    }
  };

  const approve = async (): Promise<void> => {
    if (!stepId) return;
    setBusy(true);
    try {
      await api.approve(stepId);
      onGraphChanged();
    } finally {
      setBusy(false);
    }
  };

  const getHandoff = async (): Promise<void> => {
    if (!stepId) return;
    setBusy(true);
    try {
      setHandoff((await api.handoff(stepId)).instruction);
    } finally {
      setBusy(false);
    }
  };

  const onNodeSelect = (id: string): void => {
    if (featureId) void selectStep(id);
    else enterFeature(id);
  };

  const crumbs = featureId
    ? [
        { id: 'root', label: 'Constellation' },
        { id: featureId, label: titleOf(featureId) },
      ]
    : [{ id: 'root', label: 'Constellation' }];

  const header = (
    <div className="pm-toolbar">
      <Breadcrumb items={crumbs} onNavigate={(id) => id === 'root' && setFeatureId(null)} />
      <div className="pm-toolbar-controls">
        {featureId ? <LensSwitch value={lens} onChange={setLens} /> : null}
      </div>
    </div>
  );

  const footer = (
    <div className="pm-statusbar">
      <StatusLegend />
      <span className="pm-statusbar-hint">
        {featureId
          ? `Feature Space · ${view.nodes.length} steps · click a step for impact`
          : `Constellation · ${view.nodes.length} features · click a feature to zoom in`}
      </span>
    </div>
  );

  const aside =
    stepId && impact ? (
      <div className="pm-panel-stack">
        <ImpactPanel impact={impact} onClose={closePanel} />
        <div className="pm-panel-actions">
          <button
            type="button"
            className="pm-btn is-primary"
            disabled={busy}
            onClick={() => void approve()}
          >
            Approve node
          </button>
          <button
            type="button"
            className="pm-btn"
            disabled={busy}
            onClick={() => void getHandoff()}
          >
            Get agent handoff
          </button>
        </div>
        {handoff ? (
          <div className="pm-section pm-handoff">
            <div className="pm-section-h">Scoped handoff</div>
            <pre className="pm-code-block">{handoff}</pre>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <AppShell rail={rail} header={header} footer={footer} aside={aside}>
      <PlanGraph
        view={view}
        selectedId={stepId ?? undefined}
        onSelect={onNodeSelect}
        emptyLabel={
          featureId
            ? 'No steps in this lens. Switch to Business to see the whole feature.'
            : 'No features mapped yet.'
        }
      />
    </AppShell>
  );
}

/* ------------------------------ Evolution view ------------------------------ */

interface EvolutionViewProps {
  rail: JSX.Element;
  graph: GraphSnapshot;
}

function EvolutionView({ rail, graph }: EvolutionViewProps): JSX.Element {
  const tree = useMemo(() => toEvoTree(graph), [graph]);
  const [selected, setSelected] = useState<EvoNode | null>(null);
  const [tag, setTag] = useState<string>('all');

  const header = (
    <div className="pm-toolbar">
      <Breadcrumb items={[{ id: 'root', label: tree.title }]} />
      <div className="pm-toolbar-controls">
        <div className="pm-lens-switch" role="tablist" aria-label="Tag filter">
          {EVO_TAGS.map((t) => (
            <button
              type="button"
              role="tab"
              key={t}
              aria-selected={tag === t}
              className={`pm-lens-btn${tag === t ? ' is-active' : ''}`}
              onClick={() => setTag(t)}
            >
              <span className="pm-lens-swatch" data-lens={t === 'all' ? undefined : t} />
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="pm-statusbar">
      <StatusLegend />
      <span className="pm-statusbar-hint">
        Derived from code · read-only · click a node for detail
      </span>
    </div>
  );

  return (
    <AppShell
      rail={rail}
      header={header}
      footer={footer}
      aside={selected ? <EvoNodeDetail node={selected} onClose={() => setSelected(null)} /> : null}
    >
      <div className="pm-tree-scroll">
        <EvolutionTree
          root={tree}
          filterTag={tag}
          selectedId={selected?.id}
          onSelect={setSelected}
        />
      </div>
    </AppShell>
  );
}

/* --------------------------------- Splash --------------------------------- */

function Splash({ children, tone }: { children: ReactNode; tone?: 'error' }): JSX.Element {
  return (
    <div className="planmap-root pm-shell">
      <div className="pm-splash" data-tone={tone}>
        <div className="pm-splash-mark" />
        <div className="pm-splash-text">{children}</div>
      </div>
    </div>
  );
}
