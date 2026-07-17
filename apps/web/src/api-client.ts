import type { DriftReport, Edge, ImpactResult, Node } from '@planmap/core';

export interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface MapResult {
  nodes: number;
  edges: number;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return (await res.json()) as T;
}

const withId = (base: string, id: string): string => `${base}/${encodeURIComponent(id)}`;

/** Typed wrappers over the local PlanMap API. The engine runs on the server. */
export const api = {
  graph: () => getJson<GraphSnapshot>('/api/graph'),
  impact: (id: string) => getJson<ImpactResult>(withId('/api/impact', id)),
  approve: (id: string) => postJson<{ ok: boolean }>(withId('/api/approve', id)),
  drift: () => getJson<DriftReport>('/api/drift'),
  handoff: (id: string) => getJson<{ instruction: string }>(withId('/api/handoff', id)),
  projection: () => getJson<{ markdown: string }>('/api/projection'),
  map: () => postJson<MapResult>('/api/map'),
};
