import { createHash } from 'node:crypto';

/**
 * Whitespace-normalized content hash. Collapsing runs of whitespace means a
 * pure reformat does not change the fingerprint, so it is not flagged as drift.
 * Truncated to 12 hex chars — enough to make collisions negligible for a repo.
 */
export function normalizeAndHash(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

/**
 * Fingerprint a 1-based, inclusive line range of a file's content. Used to hash
 * a node's linked code range for drift detection.
 */
export function fingerprintRange(content: string, range: [number, number]): string {
  const lines = content.split(/\r?\n/);
  const [start, end] = range;
  const slice = lines.slice(Math.max(0, start - 1), end).join('\n');
  return normalizeAndHash(slice);
}
