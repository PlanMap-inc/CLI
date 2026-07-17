import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Drift, Edge, EdgeQuery, Node, NodeQuery, StorageAdapter } from '@planmap/core';
import { EdgeSchema, NodeSchema } from '@planmap/core';

import { migrate, SCHEMA_VERSION, type StoreConfig } from './migrations';
import { configPath, edgesDir, nodesDir, projectionsDir } from './paths';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonDir(dir: string): Promise<Record<string, unknown>[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: Record<string, unknown>[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    out.push(JSON.parse(await readFile(join(dir, name), 'utf8')) as Record<string, unknown>);
  }
  return out;
}

const pretty = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Node/edge ids contain ':' '/' '#' — encode them into safe, flat filenames.
 *  The canonical id lives inside the JSON, so reads never depend on the name. */
const safeName = (id: string): string => encodeURIComponent(id);

/**
 * The persistent, JSON-canonical `.planmap` store. Files under `nodes/`,
 * `edges/`, and `drift/` are the source of truth; an in-memory index (built on
 * open) serves fast queries. Implements the same `StorageAdapter` contract as
 * `MemoryStore`, so the engine is unaware which store it runs against.
 */
export class LocalStore implements StorageAdapter {
  private constructor(
    private readonly root: string,
    private readonly nodes: Map<string, Node>,
    private readonly edges: Map<string, Edge>,
  ) {}

  static async open(root: string): Promise<LocalStore> {
    await mkdir(nodesDir(root), { recursive: true });
    await mkdir(edgesDir(root), { recursive: true });
    await mkdir(projectionsDir(root), { recursive: true });

    let config: StoreConfig;
    if (await exists(configPath(root))) {
      config = JSON.parse(await readFile(configPath(root), 'utf8')) as StoreConfig;
    } else {
      config = {
        version: SCHEMA_VERSION,
        edition: 'solo',
        connectors: ['git'],
        llm: { provider: 'anthropic' },
      };
      await writeFile(configPath(root), pretty(config));
    }

    let rawNodes = await readJsonDir(nodesDir(root));
    let rawEdges = await readJsonDir(edgesDir(root));

    // Forward-migrate an older store, then persist and bump the version.
    if ((config.version ?? 0) < SCHEMA_VERSION) {
      const result = migrate({ nodes: rawNodes, edges: rawEdges }, config.version ?? 0);
      rawNodes = result.raw.nodes;
      rawEdges = result.raw.edges;
      config.version = SCHEMA_VERSION;
      await writeFile(configPath(root), pretty(config));
      for (const raw of rawNodes) {
        await writeFile(join(nodesDir(root), `${safeName(String(raw['id']))}.json`), pretty(raw));
      }
      for (const raw of rawEdges) {
        await writeFile(join(edgesDir(root), `${safeName(String(raw['id']))}.json`), pretty(raw));
      }
    }

    const nodes = new Map<string, Node>();
    for (const raw of rawNodes) {
      const node = NodeSchema.parse(raw);
      nodes.set(node.id, node);
    }
    const edges = new Map<string, Edge>();
    for (const raw of rawEdges) {
      const edge = EdgeSchema.parse(raw);
      edges.set(edge.id, edge);
    }
    return new LocalStore(root, nodes, edges);
  }

  private async persistNode(node: Node): Promise<void> {
    await writeFile(join(nodesDir(this.root), `${safeName(node.id)}.json`), pretty(node));
  }

  async getNode(id: string): Promise<Node | null> {
    const node = this.nodes.get(id);
    return node ? structuredClone(node) : null;
  }

  async putNode(node: Node): Promise<void> {
    const parsed = NodeSchema.parse(node);
    this.nodes.set(parsed.id, structuredClone(parsed));
    await this.persistNode(parsed);
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
    const parsed = EdgeSchema.parse(edge);
    this.edges.set(parsed.id, structuredClone(parsed));
    await writeFile(join(edgesDir(this.root), `${safeName(parsed.id)}.json`), pretty(parsed));
  }

  async listDrifted(): Promise<Node[]> {
    return [...this.nodes.values()]
      .filter((n) => n.status === 'drifted' || n.status === 'error')
      .map((n) => structuredClone(n));
  }

  async recordVerification(nodeId: string, at: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.last_verified = at;
      await this.persistNode(node);
    }
  }

  async recordApproval(planNodeId: string, at: string): Promise<void> {
    const node = this.nodes.get(planNodeId);
    if (node && node.status === 'intended') {
      node.status = 'approved';
      node.last_verified = at;
      await this.persistNode(node);
    }
  }

  async appendAnnotation(nodeId: string, body: string, _at: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.annotation = body;
      await this.persistNode(node);
    }
  }

  async appendDrift(nodeId: string, drift: Drift): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.drift = drift;
      node.status = 'drifted';
      await this.persistNode(node);
    }
  }

  async transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T> {
    const nodesSnap = [...this.nodes.values()].map((n) => structuredClone(n));
    const edgesSnap = [...this.edges.values()].map((e) => structuredClone(e));
    try {
      return await fn(this);
    } catch (error) {
      // Restore in-memory state and rewrite disk to match the snapshot.
      this.nodes.clear();
      this.edges.clear();
      for (const n of nodesSnap) this.nodes.set(n.id, n);
      for (const e of edgesSnap) this.edges.set(e.id, e);
      await rm(nodesDir(this.root), { recursive: true, force: true });
      await rm(edgesDir(this.root), { recursive: true, force: true });
      await mkdir(nodesDir(this.root), { recursive: true });
      await mkdir(edgesDir(this.root), { recursive: true });
      for (const n of nodesSnap) await this.persistNode(n);
      for (const e of edgesSnap) {
        await writeFile(join(edgesDir(this.root), `${safeName(e.id)}.json`), pretty(e));
      }
      throw error;
    }
  }
}
