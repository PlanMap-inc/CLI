import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import { useMemo } from 'react';

import type { PlanGraphView, PlanStatus } from '../model';
import { StatusDot } from './Status';

/** Node payload React Flow carries; a plain object so it satisfies React Flow's constraint. */
export type PlanNodeData = {
  title: string;
  sub?: string;
  status: PlanStatus;
  color?: string;
};

export type PlanFlowNode = Node<PlanNodeData, 'plan'>;

/** The card that represents a feature (Constellation) or a step (Feature Space). */
function PlanNodeCard({ data, selected }: NodeProps<PlanFlowNode>): JSX.Element {
  return (
    <div className={`pm-gnode${selected ? ' is-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="pm-gnode-handle" />
      <div className="pm-gnode-bar" style={{ background: data.color ?? 'var(--pm-c-default)' }} />
      <div className="pm-gnode-title">{data.title}</div>
      {data.sub ? <div className="pm-gnode-sub">{data.sub}</div> : null}
      <div className="pm-gnode-status">
        <StatusDot status={data.status} color={data.color} />
        {data.status}
      </div>
      <Handle type="source" position={Position.Bottom} className="pm-gnode-handle" />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { plan: PlanNodeCard };

/**
 * Pure mapping from the view-model to React Flow's node/edge shape. Kept separate
 * from the component so the transform is unit-testable without mounting a canvas.
 */
export function planGraphToFlow(
  view: PlanGraphView,
  selectedId?: string,
): { nodes: PlanFlowNode[]; edges: Edge[] } {
  const nodes: PlanFlowNode[] = view.nodes.map((n) => ({
    id: n.id,
    type: 'plan',
    position: { x: n.x, y: n.y },
    selected: n.id === selectedId,
    data: { title: n.title, sub: n.sub, status: n.status, color: n.color },
  }));
  const edges: Edge[] = view.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
  }));
  return { nodes, edges };
}

interface PlanGraphProps {
  view: PlanGraphView;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  emptyLabel?: string;
}

/**
 * The pannable, zoomable map — the hero of the product. Nodes are laid out from the
 * engine's coordinates; the graph is read-first (nodes are not draggable or
 * connectable in M1) so the canvas reflects reality rather than inviting doodling.
 * Requires the host app to import `@xyflow/react/dist/style.css`.
 */
export function PlanGraph({
  view,
  selectedId,
  onSelect,
  onActivate,
  emptyLabel,
}: PlanGraphProps): JSX.Element {
  const { nodes, edges } = useMemo(() => planGraphToFlow(view, selectedId), [view, selectedId]);

  if (view.nodes.length === 0) {
    return (
      <div className="pm-canvas pm-canvas-empty">
        <p className="pm-empty">
          {emptyLabel ?? 'Nothing mapped yet. Run a map to populate the graph.'}
        </p>
      </div>
    );
  }

  return (
    <div className="pm-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.15 }}
        minZoom={0.3}
        maxZoom={2.2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onSelect?.(node.id)}
        onNodeDoubleClick={(_, node) => onActivate?.(node.id)}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1c212b" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
