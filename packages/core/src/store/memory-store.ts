import type { Drift, Edge, Node } from '../model';

import type { EdgeQuery, NodeQuery, StorageAdapter } from './adapter';

/**
 * A pure in-memory `StorageAdapter`. Zero I/O — the reference implementation of
 * the store contract, used by tests and ephemeral runs. The persistent,
 * git-committed `LocalStore` lives in `@planmap/db` and implements the same
 * interface with identical semantics.
 *
 * Values are cloned on the way in and out, so the store owns its data and
 * callers cannot mutate it by reference (matching how a serialized store behaves).
 */
export class MemoryStore implements StorageAdapter {
  private readonly nodes = new Map<string, Node>();
  private readonly edges = new Map<string, Edge>();
  private readonly approvals = new Map<string, string>();
  private readonly annotations: Array<{ nodeId: string; body: string; at: string }> = [];

  async getNode(id: string): Promise<Node | null> {
    const node = this.nodes.get(id);
    return node ? structuredClone(node) : null;
  }

  async putNode(node: Node): Promise<void> {
    this.nodes.set(node.id, structuredClone(node));
  }

  async queryNodes(query?: NodeQuery): Promise<Node[]> {
    let out = [...this.nodes.values()];
    if (query?.graph) out = out.filter((n) => n.graph === query.graph);
    if (query?.level) out = out.filter((n) => n.level === query.level);
    if (query?.type) out = out.filter((n) => n.type === query.type);
    if (query?.status) out = out.filter((n) => n.status === query.status);
    if (query?.parent !== undefined) out = out.filter((n) => n.parent === query.parent);
    return out.map((n) => structuredClone(n));
  }

  async getEdges(query?: EdgeQuery): Promise<Edge[]> {
    let out = [...this.edges.values()];
    if (query?.from) out = out.filter((e) => e.from === query.from);
    if (query?.to) out = out.filter((e) => e.to === query.to);
    if (query?.type) out = out.filter((e) => e.type === query.type);
    if (query?.graph) out = out.filter((e) => e.graph === query.graph);
    return out.map((e) => structuredClone(e));
  }

  async putEdge(edge: Edge): Promise<void> {
    this.edges.set(edge.id, structuredClone(edge));
  }

  async listDrifted(): Promise<Node[]> {
    return [...this.nodes.values()]
      .filter((n) => n.status === 'drifted' || n.status === 'error')
      .map((n) => structuredClone(n));
  }

  async recordVerification(nodeId: string, at: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (node) node.last_verified = at;
  }

  async recordApproval(planNodeId: string, at: string): Promise<void> {
    this.approvals.set(planNodeId, at);
    const node = this.nodes.get(planNodeId);
    if (node && node.status === 'intended') node.status = 'approved';
  }

  async appendAnnotation(nodeId: string, body: string, at: string): Promise<void> {
    this.annotations.push({ nodeId, body, at });
    const node = this.nodes.get(nodeId);
    if (node) node.annotation = body;
  }

  async appendDrift(nodeId: string, drift: Drift): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.drift = drift;
      node.status = 'drifted';
    }
  }

  async transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T> {
    const nodesSnap = new Map<string, Node>();
    for (const [k, v] of this.nodes) nodesSnap.set(k, structuredClone(v));
    const edgesSnap = new Map<string, Edge>();
    for (const [k, v] of this.edges) edgesSnap.set(k, structuredClone(v));
    const approvalsSnap = new Map(this.approvals);
    const annotationsSnap = this.annotations.map((a) => ({ ...a }));

    try {
      return await fn(this);
    } catch (error) {
      this.nodes.clear();
      for (const [k, v] of nodesSnap) this.nodes.set(k, v);
      this.edges.clear();
      for (const [k, v] of edgesSnap) this.edges.set(k, v);
      this.approvals.clear();
      for (const [k, v] of approvalsSnap) this.approvals.set(k, v);
      this.annotations.length = 0;
      this.annotations.push(...annotationsSnap);
      throw error;
    }
  }
}
