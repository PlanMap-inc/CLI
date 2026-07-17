import { z } from 'zod';

import {
  ConfidenceSchema,
  EdgeTypeSchema,
  GraphSchema,
  LensTagSchema,
  LevelSchema,
  NodeTypeSchema,
  OriginSchema,
  ProvenanceSchema,
  StatusSchema,
} from './enums';

/**
 * A pointer from a node to a real range of code, plus the fingerprint of that
 * range at approval time. Drift is detected by re-hashing and comparing.
 */
export const LinkedCodeSchema = z.object({
  path: z.string(),
  range: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  hash: z.string(),
  /** The symbol this range defines, when known — enables symbol-precise impact. */
  symbol: z.string().optional(),
  /** Recomputed on re-read; present once a verification has run. */
  current_hash: z.string().optional(),
});
export type LinkedCode = z.infer<typeof LinkedCodeSchema>;

/** A recorded drift event, populated only when a node's status is `drifted`. */
export const DriftSchema = z.object({
  detected_at: z.string(),
  file: z.string(),
  issue: z.string(),
  likely_cause: z.string().optional(),
});
export type Drift = z.infer<typeof DriftSchema>;

/**
 * The single node shape used by both the Plan Graph and the Evolution Graph.
 * `intent` (plan) and `summary` (evolution) are deliberately separate fields —
 * drift is exactly the delta between them, so collapsing them would erase the
 * comparison that is the whole product.
 */
export const NodeSchema = z.object({
  id: z.string(),
  graph: GraphSchema,
  level: LevelSchema,
  type: NodeTypeSchema,
  title: z.string(),

  /** PLAN only: the intended behaviour (human-owned). `null` on evolution nodes. */
  intent: z.string().nullable().optional(),
  /** EVOLUTION only: what the code actually does (read from code). */
  summary: z.string().nullable().optional(),
  /** Optional originating instruction; never the source of a node's placement. */
  prompt: z.string().nullable().optional(),

  status: StatusSchema,
  origin: OriginSchema,
  parent: z.string().nullable(),

  /** Ordered flow to the next step(s) at this altitude. */
  edges_out: z.array(z.string()).default([]),
  lens_tags: z.array(LensTagSchema).default([]),
  linked_code: z.array(LinkedCodeSchema).default([]),

  /** Cached dependency rollups (derived from typed edges; present for fast rendering). */
  depends_on: z.array(z.string()).default([]),
  depended_on_by: z.array(z.string()).default([]),

  /** The explicitly approved plan node this evolution node is drift-checked against. */
  approved_against: z.string().nullable().optional(),

  /** The "why" — the behavioral moat; the thing chat loses. */
  annotation: z.string().nullable().optional(),
  drift: DriftSchema.nullable().optional(),

  created_at: z.string(),
  last_verified: z.string().nullable().optional(),
});
export type Node = z.infer<typeof NodeSchema>;

/**
 * A first-class semantic relationship between two nodes. Every edge records its
 * provenance and a confidence; inferred edges must render visibly distinct.
 */
export const EdgeSchema = z.object({
  id: z.string(),
  type: EdgeTypeSchema,
  from: z.string(),
  to: z.string(),
  graph: GraphSchema,
  provenance: ProvenanceSchema,
  confidence: ConfidenceSchema,
});
export type Edge = z.infer<typeof EdgeSchema>;
