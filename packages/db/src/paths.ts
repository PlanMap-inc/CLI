import { join } from 'node:path';

/** The `.planmap/` store layout, relative to a repo/workspace root. OS-agnostic. */
export const planmapDir = (root: string): string => join(root, '.planmap');
export const configPath = (root: string): string => join(planmapDir(root), 'config.json');
export const nodesDir = (root: string): string => join(planmapDir(root), 'nodes');
export const edgesDir = (root: string): string => join(planmapDir(root), 'edges');
export const projectionsDir = (root: string): string => join(planmapDir(root), 'projections');
