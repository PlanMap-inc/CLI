import type { Drift, Edge, Graph, Level, Node, NodeType, Status } from '../model';

export interface NodeQuery {
  graph?: Graph;
  level?: Level;
  type?: NodeType;
  parent?: string | null;
  status?: Status;
}

export interface EdgeQuery {
  from?: string;
  to?: string;
  type?: Edge['type'];
  graph?: Graph;
}

/**
 * The persistence seam. `@planmap/core` depends only on this interface — it
 * never issues SQL and never touches a filesystem path. Implemented by
 * `LocalStore` (Solo, JSON-canonical) and later `CloudStore` (Team/Org,
 * Postgres) against an identical logical schema, so an edition is a deployment
 * choice, not a fork.
 */
export interface StorageAdapter {
  getNode(id: string): Promise<Node | null>;
  putNode(node: Node): Promise<void>;
  queryNodes(query?: NodeQuery): Promise<Node[]>;
  getEdges(query?: EdgeQuery): Promise<Edge[]>;
  putEdge(edge: Edge): Promise<void>;
  listDrifted(): Promise<Node[]>;
  recordVerification(nodeId: string, at: string): Promise<void>;
  recordApproval(planNodeId: string, at: string): Promise<void>;
  appendAnnotation(nodeId: string, body: string, at: string): Promise<void>;
  appendDrift(nodeId: string, drift: Drift): Promise<void>;
  transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T>;
}
