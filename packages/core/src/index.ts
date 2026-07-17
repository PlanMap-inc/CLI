/**
 * @planmap/core — the PlanMap engine.
 *
 * Pure TypeScript with zero dependencies on a filesystem, network, database,
 * DOM, or editor. All business logic lives here; surfaces (CLI, web, VS Code)
 * are thin transports over this package.
 */
export * from './model';
export * from './store';
export * from './connector';
export * from './llm';
export * from './impact';
export * from './entitlements';
export * from './depgraph';
