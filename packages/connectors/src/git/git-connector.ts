import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { Artifact, Capability, Connector, Hash, Range, Resource, Scope } from '@planmap/core';

import { fingerprintRange, normalizeAndHash } from '../fingerprint';

const SOURCE_RE = /\.(ts|tsx|js|jsx)$/;
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.turbo', 'coverage']);

async function collect(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) await collect(full, out);
    } else if (SOURCE_RE.test(entry.name)) {
      out.push(full);
    }
  }
}

/**
 * The `git` connector: discovers source files on disk, reads them, and computes
 * whitespace-normalized fingerprints. OS-agnostic (paths via `node:path`,
 * resource ids normalized to `/`).
 */
export class GitConnector implements Connector {
  readonly id = 'git';
  readonly capabilities: Capability[] = ['code'];

  async *discover(scope: Scope): AsyncIterable<Resource> {
    const files: string[] = [];
    await collect(scope.root, files);
    files.sort((a, b) => a.localeCompare(b));
    for (const abs of files) {
      yield { id: relative(scope.root, abs).replaceAll('\\', '/'), kind: 'file', path: abs };
    }
  }

  async read(resource: Resource): Promise<Artifact> {
    const abs = resource.path ?? resource.id;
    const content = await readFile(abs, 'utf8');
    return { resource, content };
  }

  fingerprint(artifact: Artifact, range?: Range): Hash {
    return range
      ? fingerprintRange(artifact.content, [range[0], range[1]])
      : normalizeAndHash(artifact.content);
  }
}
