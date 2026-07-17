/** A layer a connector can observe. */
export type Capability = 'code' | 'schema' | 'cloud' | 'ci' | 'usage';

/** A stable fingerprint of an artifact (or a range of it) — the basis of drift. */
export type Hash = string;

/** An inclusive [start, end] range within an artifact. */
export type Range = readonly [number, number];

/** Where a connector should look. */
export interface Scope {
  root: string;
}

/** Something a connector found (a repo, file, table, cloud resource, …). */
export interface Resource {
  id: string;
  kind: string;
  path?: string;
}

/** The ground-truth content a connector fetched for a resource. */
export interface Artifact {
  resource: Resource;
  content: string;
}

/**
 * A connector turns some external reality (a git repo today; a DB, cloud
 * account, or CI system later) into normalized artifacts the engine folds into
 * the Evolution Graph and links to Plan-Graph nodes. Core knows only this
 * interface; the active edition decides which connectors are registered. New
 * layer ⇒ new connector, with no core changes.
 */
export interface Connector {
  id: string;
  capabilities: Capability[];
  discover(scope: Scope): AsyncIterable<Resource>;
  read(resource: Resource): Promise<Artifact>;
  fingerprint(artifact: Artifact, range?: Range): Hash;
}
