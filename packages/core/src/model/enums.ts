import { z } from 'zod';

/**
 * Canonical enums for the PlanMap data model.
 *
 * Each enum is defined schema-first (a `zod` enum), with the TypeScript union
 * type derived via `z.infer` and the runtime value list exposed via `.options`.
 * This keeps the validator, the type, and the iterable value list in perfect
 * sync — there is exactly one source of truth per enum.
 */

/** Which graph a node/edge belongs to: the intended plan, or observed reality. */
export const GraphSchema = z.enum(['plan', 'evolution']);
export type Graph = z.infer<typeof GraphSchema>;
export const GRAPHS = GraphSchema.options;

/** Zoom altitude. Only two levels in v1 (an `estate` altitude is a v2 concern). */
export const LevelSchema = z.enum(['constellation', 'feature_space']);
export type Level = z.infer<typeof LevelSchema>;
export const LEVELS = LevelSchema.options;

/** Entity kind, spanning the full org-graph containment spine. */
export const NodeTypeSchema = z.enum([
  'product',
  'service',
  'repo',
  'module',
  'feature',
  'step',
  'element',
  'endpoint',
  'table',
  'cloud_resource',
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NODE_TYPES = NodeTypeSchema.options;

/** Lifecycle state of a node. `intended -> approved -> implemented -> drifted/error`. */
export const StatusSchema = z.enum(['intended', 'approved', 'implemented', 'drifted', 'error']);
export type Status = z.infer<typeof StatusSchema>;
export const STATUSES = StatusSchema.options;

/** Who authored a node. Human-authored nodes are never silently overwritten by AI. */
export const OriginSchema = z.enum(['ai_generated', 'manually_added', 'ai_edited_by_human']);
export type Origin = z.infer<typeof OriginSchema>;
export const ORIGINS = OriginSchema.options;

/** Semantic relationship kinds. Decided by a parser/connector, never by the LLM. */
export const EdgeTypeSchema = z.enum(['imports', 'calls', 'depends_on', 'deploys', 'reads', 'writes']);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;
export const EDGE_TYPES = EdgeTypeSchema.options;

/** Where an edge/finding came from. */
export const ProvenanceSchema = z.enum([
  'static_analysis',
  'connector:postgres',
  'connector:aws',
  'connector:jenkins',
  'manual',
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;
export const PROVENANCES = ProvenanceSchema.options;

/** Confidence in a fact. Uncertainty is always visible: certain vs. inferred. */
export const ConfidenceSchema = z.enum(['certain', 'inferred']);
export type Confidence = z.infer<typeof ConfidenceSchema>;
export const CONFIDENCES = ConfidenceSchema.options;

/** Lens tags. Metadata only — a tag never determines a node's position. */
export const LensTagSchema = z.enum(['business', 'backend', 'security', 'frontend']);
export type LensTag = z.infer<typeof LensTagSchema>;
export const LENS_TAGS = LensTagSchema.options;
