import type { RepoStructure } from '@planmap/core';

import { analyzeTypeScriptRepo } from './git/ts-analyzer';
import { analyzePythonRepo } from './lang/py-analyzer';

/**
 * Analyze a repo across every supported language and merge the results into one
 * `RepoStructure`. Each analyzer is language-specific; the engine downstream is not —
 * it reasons only over the normalized units and facts, so adding a language never
 * touches the engine. Units are de-duplicated by id (both analyzers emit a `repo`
 * root); facts are concatenated.
 */
export async function analyzeRepo(dir: string): Promise<RepoStructure> {
  const ts = analyzeTypeScriptRepo(dir);
  const py = await analyzePythonRepo(dir);

  const units = [...ts.units];
  const seen = new Set(units.map((u) => u.id));
  for (const unit of py.units) {
    if (seen.has(unit.id)) continue;
    seen.add(unit.id);
    units.push(unit);
  }

  const files = [...new Set([...ts.facts.files, ...py.facts.files])];
  const edges = [...ts.facts.edges, ...py.facts.edges];
  return { units, facts: { files, edges } };
}
