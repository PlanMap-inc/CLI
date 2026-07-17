/** The current .planmap schema version. Bump this when you add a migration. */
export const SCHEMA_VERSION = 1;

export interface StoreConfig {
  version: number;
  edition: string;
  connectors: string[];
  llm: { provider: string };
}

/** The raw (pre-validation) node/edge JSON a migration transforms. */
export interface RawStore {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
}

export interface Migration {
  /** The version this migration produces. */
  to: number;
  /** A pure transform bringing the store from `to - 1` up to `to`. */
  up(raw: RawStore): RawStore;
}

/**
 * Ordered forward migrations for the `.planmap` store — the `makemigrations`
 * analog. Empty at v1; add one entry per schema change. Example:
 *
 * ```ts
 * { to: 2, up: (raw) => ({ ...raw, nodes: raw.nodes.map((n) => ({ ...n, tier: 'solo' })) }) }
 * ```
 */
export const MIGRATIONS: Migration[] = [];

/**
 * Apply every migration newer than `fromVersion`, in order. Pure — the caller
 * persists the result and records the new version.
 */
export function migrate(
  raw: RawStore,
  fromVersion: number,
  migrations: Migration[] = MIGRATIONS,
): { raw: RawStore; version: number } {
  let current = raw;
  let version = fromVersion;
  const pending = [...migrations].filter((m) => m.to > fromVersion).sort((a, b) => a.to - b.to);
  for (const migration of pending) {
    current = migration.up(current);
    version = migration.to;
  }
  return { raw: current, version };
}
