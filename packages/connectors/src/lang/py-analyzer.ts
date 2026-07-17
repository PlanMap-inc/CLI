import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

import type { DepEdge, LensTag, RepoStructure, RepoUnit } from '@planmap/core';
import { Language, type Node as SyntaxNode, Parser } from 'web-tree-sitter';

import { fingerprintRange } from '../fingerprint';

const SKIP_DIRS = new Set([
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.git',
  '.planmap',
]);

function toRel(dir: string, abs: string): string {
  return relative(dir, abs).replaceAll('\\', '/');
}

/** First path segment under an optional `src/` prefix — the "feature" area. */
function featureOf(rel: string): string | null {
  const trimmed = rel.startsWith('src/') ? rel.slice(4) : rel;
  const parts = trimmed.split('/');
  const first = parts[0];
  return parts.length > 1 && first ? first : null;
}

function lensTagsFor(rel: string): LensTag[] {
  return /auth|security|login|session|token|password|jwt/i.test(rel) ? ['security'] : [];
}

function isTestFile(name: string): boolean {
  return name.startsWith('test_') || name.endsWith('_test.py') || name === 'conftest.py';
}

/** Recursively collect Python source files, pruning vendored / cache directories. */
async function pythonFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.py') && !isTestFile(entry.name)) {
        out.push(join(dir, entry.name));
      }
    }
  };
  await walk(root);
  return out.sort();
}

// The parsed grammar is loaded once and reused across calls (WASM init is not free).
let languagePromise: Promise<Language> | null = null;
async function loadPython(): Promise<Language> {
  if (!languagePromise) {
    languagePromise = (async () => {
      await Parser.init();
      const require = createRequire(import.meta.url);
      const wasm = require.resolve('tree-sitter-wasms/out/tree-sitter-python.wasm');
      return Language.load(await readFile(wasm));
    })();
  }
  return languagePromise;
}

/** The top-level def/class nodes of a module (unwrapping decorators). */
function topLevelDefs(root: SyntaxNode): SyntaxNode[] {
  const defs: SyntaxNode[] = [];
  for (const child of root.namedChildren) {
    if (!child) continue;
    if (child.type === 'function_definition' || child.type === 'class_definition') {
      defs.push(child);
    } else if (child.type === 'decorated_definition') {
      const def = child.childForFieldName('definition');
      if (def && (def.type === 'function_definition' || def.type === 'class_definition')) {
        defs.push(def);
      }
    }
  }
  return defs;
}

function nameOf(node: SyntaxNode): string | undefined {
  return node.childForFieldName('name')?.text;
}

/** The called symbol's bare name: `foo` from `foo(...)` or `x.foo` from `x.foo(...)`. */
function calleeName(fn: SyntaxNode | null): string | undefined {
  if (!fn) return undefined;
  if (fn.type === 'identifier') return fn.text;
  if (fn.type === 'attribute') return fn.childForFieldName('attribute')?.text;
  return undefined;
}

interface CallSite {
  name: string;
  from?: string;
}

/** Every call in a module, tagged with the nearest enclosing def/class name. */
function collectCalls(root: SyntaxNode): CallSite[] {
  const calls: CallSite[] = [];
  const walk = (node: SyntaxNode, enclosing?: string): void => {
    let current = enclosing;
    if (node.type === 'function_definition' || node.type === 'class_definition') {
      current = nameOf(node) ?? enclosing;
    }
    if (node.type === 'call') {
      const name = calleeName(node.childForFieldName('function'));
      if (name) calls.push({ name, from: current });
    }
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      if (child) walk(child, current);
    }
  };
  walk(root, undefined);
  return calls;
}

/** Dotted import names in a module: `import a.b`, `from a.b import c`. */
function collectImports(root: SyntaxNode): string[] {
  const modules: string[] = [];
  const walk = (node: SyntaxNode): void => {
    if (node.type === 'import_statement') {
      for (const child of node.namedChildren) {
        if (!child) continue;
        if (child.type === 'dotted_name') modules.push(child.text);
        else if (child.type === 'aliased_import') {
          const name = child.childForFieldName('name');
          if (name) modules.push(name.text);
        }
      }
    } else if (node.type === 'import_from_statement') {
      const moduleName = node.childForFieldName('module_name');
      if (moduleName && moduleName.type === 'dotted_name') modules.push(moduleName.text);
    }
    for (let i = 0; i < node.childCount; i += 1) {
      const child = node.child(i);
      if (child) walk(child);
    }
  };
  walk(root);
  return modules;
}

interface FileParse {
  rel: string;
  source: string;
  root: SyntaxNode;
  elements: { name: string; range: [number, number]; hash: string }[];
}

/**
 * Compiler-free static analysis of a Python repo via tree-sitter (WASM, so no native
 * build on any OS). Produces the same `RepoStructure` the engine consumes. Imports are
 * resolved by path (`certain`); cross-file calls are matched by symbol name and marked
 * `inferred` — tree-sitter has no type resolution, so a name match is a strong signal,
 * not a proof, and the graph says so rather than inventing certainty.
 */
export async function analyzePythonRepo(dir: string): Promise<RepoStructure> {
  const root = dir.replaceAll('\\', '/');
  const absFiles = await pythonFiles(dir);
  if (absFiles.length === 0) return { units: [], facts: { files: [], edges: [] } };

  const language = await loadPython();
  const parser = new Parser();
  parser.setLanguage(language);

  const units: RepoUnit[] = [];
  const files: string[] = [];
  const repoIdName = root.split('/').filter(Boolean).pop() ?? 'repo';
  units.push({ id: 'repo', kind: 'repo', title: repoIdName, parent: null });

  const featureIds = new Map<string, string>();
  const ensureFeature = (name: string): string => {
    const existing = featureIds.get(name);
    if (existing) return existing;
    const id = `feature:${name}`;
    units.push({ id, kind: 'feature', title: name, parent: 'repo' });
    featureIds.set(name, id);
    return id;
  };

  // Pass 1: parse each file, create units, and record parses for pass 2.
  const parses: FileParse[] = [];
  // name -> files that define an element with that name (for call resolution).
  const definedIn = new Map<string, Set<string>>();

  for (const abs of absFiles) {
    const rel = toRel(dir, abs);
    files.push(rel);
    const source = await readFile(abs, 'utf8');
    const tree = parser.parse(source);
    if (!tree) continue;
    const treeRoot = tree.rootNode;

    const feature = featureOf(rel);
    const parentId = feature ? ensureFeature(feature) : 'repo';
    const moduleId = `module:${rel}`;
    units.push({ id: moduleId, kind: 'module', title: rel, parent: parentId });

    const elements: FileParse['elements'] = [];
    for (const def of topLevelDefs(treeRoot)) {
      const name = nameOf(def);
      if (!name) continue;
      const range: [number, number] = [def.startPosition.row + 1, def.endPosition.row + 1];
      const hash = fingerprintRange(source, range);
      units.push({
        id: `element:${rel}#${name}`,
        kind: 'element',
        title: name,
        parent: moduleId,
        file: rel,
        range,
        symbol: name,
        hash,
        lensTags: lensTagsFor(rel),
      });
      elements.push({ name, range, hash });
      const set = definedIn.get(name) ?? new Set<string>();
      set.add(rel);
      definedIn.set(name, set);
    }

    parses.push({ rel, source, root: treeRoot, elements });
  }

  const fileSet = new Set(files);
  const edges: DepEdge[] = [];
  const seen = new Set<string>();

  // Pass 2: import (path-resolved, certain) + call (name-matched, inferred) facts.
  for (const parse of parses) {
    for (const dotted of collectImports(parse.root)) {
      const target = resolveModule(dotted, fileSet);
      if (!target || target === parse.rel) continue;
      const key = `imp|${parse.rel}|${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ fromFile: parse.rel, toFile: target, kind: 'import', confidence: 'certain' });
    }

    for (const call of collectCalls(parse.root)) {
      const targets = definedIn.get(call.name);
      if (!targets) continue;
      const external = [...targets].filter((f) => f !== parse.rel);
      // Only link when exactly one other file defines the name — never guess on ambiguity.
      if (external.length !== 1) continue;
      const target = external[0] as string;
      const key = `call|${parse.rel}|${call.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        fromFile: parse.rel,
        fromSymbol: call.from,
        toFile: target,
        toSymbol: call.name,
        kind: 'call',
        confidence: 'inferred',
      });
    }
  }

  return { units, facts: { files, edges } };
}

/** Map a dotted module name to a repo-relative file, if one exists. */
function resolveModule(dotted: string, files: Set<string>): string | undefined {
  const base = dotted.split('.').join('/');
  for (const candidate of [`${base}.py`, `${base}/__init__.py`, `src/${base}.py`]) {
    if (files.has(candidate)) return candidate;
  }
  return undefined;
}
