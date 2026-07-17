import { basename, relative } from 'node:path';

import type { DepEdge, LensTag, RepoStructure, RepoUnit } from '@planmap/core';
import { type Identifier, Node, Project } from 'ts-morph';

import { fingerprintRange } from '../fingerprint';

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

function isRecordableDeclaration(decl: Node): boolean {
  return (
    Node.isFunctionDeclaration(decl) ||
    Node.isClassDeclaration(decl) ||
    Node.isVariableDeclaration(decl)
  );
}

/** The `Identifier` name node of a declaration we can follow references from. */
function findableNameNode(decl: Node): Identifier | undefined {
  if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl)) {
    return decl.getNameNode();
  }
  if (Node.isVariableDeclaration(decl)) {
    const bindingName = decl.getNameNode();
    if (Node.isIdentifier(bindingName)) return bindingName;
  }
  return undefined;
}

/** Nearest named function/class/method/variable enclosing a reference node. */
function enclosingSymbol(node: Node): string | undefined {
  let cur: Node | undefined = node.getParent();
  for (let i = 0; i < 200 && cur; i += 1) {
    if (
      Node.isFunctionDeclaration(cur) ||
      Node.isClassDeclaration(cur) ||
      Node.isMethodDeclaration(cur) ||
      Node.isVariableDeclaration(cur)
    ) {
      const name = cur.getName();
      if (name) return name;
    }
    cur = cur.getParent();
  }
  return undefined;
}

/**
 * Compiler-grade static analysis of a TypeScript/JavaScript repo via ts-morph.
 * Produces the language-agnostic `RepoStructure` the engine consumes: feature /
 * module / element units, plus import and cross-file call facts. This is the
 * "parser decides WHAT" half of the moat — the facts are factual, not guessed.
 */
export function analyzeTypeScriptRepo(dir: string): RepoStructure {
  const root = dir.replaceAll('\\', '/');
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths([
    `${root}/**/*.{ts,tsx,js,jsx}`,
    `!${root}/**/node_modules/**`,
    `!${root}/**/*.d.ts`,
    `!${root}/**/*.test.{ts,tsx,js,jsx}`,
  ]);

  const sourceFiles = project.getSourceFiles();
  const units: RepoUnit[] = [];
  const edges: DepEdge[] = [];
  const files: string[] = [];

  const repoId = 'repo';
  units.push({ id: repoId, kind: 'repo', title: basename(root) || 'repo', parent: null });

  const featureIds = new Map<string, string>();
  const ensureFeature = (name: string): string => {
    const existing = featureIds.get(name);
    if (existing) return existing;
    const id = `feature:${name}`;
    units.push({ id, kind: 'feature', title: name, parent: repoId });
    featureIds.set(name, id);
    return id;
  };

  // Pass 1: units (modules + elements) and import facts.
  for (const sf of sourceFiles) {
    const rel = toRel(dir, sf.getFilePath());
    files.push(rel);
    const feature = featureOf(rel);
    const parentId = feature ? ensureFeature(feature) : repoId;
    const moduleId = `module:${rel}`;
    units.push({ id: moduleId, kind: 'module', title: rel, parent: parentId });

    for (const [name, decls] of sf.getExportedDeclarations()) {
      const decl = decls[0];
      if (!decl || !isRecordableDeclaration(decl)) continue;
      units.push({
        id: `element:${rel}#${name}`,
        kind: 'element',
        title: name,
        parent: moduleId,
        file: rel,
        range: [decl.getStartLineNumber(), decl.getEndLineNumber()],
        symbol: name,
        // Fingerprint the line range exactly as drift verification will, so an
        // unchanged file never false-positives as drift.
        hash: fingerprintRange(sf.getFullText(), [
          decl.getStartLineNumber(),
          decl.getEndLineNumber(),
        ]),
        lensTags: lensTagsFor(rel),
      });
    }

    for (const imp of sf.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile();
      if (!target) continue;
      edges.push({ fromFile: rel, toFile: toRel(dir, target.getFilePath()), kind: 'import' });
    }
  }

  // Pass 2: cross-file call/reference facts (compiler-resolved).
  const callSeen = new Set<string>();
  for (const sf of sourceFiles) {
    const rel = toRel(dir, sf.getFilePath());
    for (const [name, decls] of sf.getExportedDeclarations()) {
      const decl = decls[0];
      if (!decl || !isRecordableDeclaration(decl)) continue;
      const nameNode = findableNameNode(decl);
      if (!nameNode) continue;

      let refs: Node[] = [];
      try {
        refs = nameNode.findReferencesAsNodes();
      } catch {
        continue; // reference resolution can throw on odd nodes — skip, never guess
      }

      for (const ref of refs) {
        const refRel = toRel(dir, ref.getSourceFile().getFilePath());
        if (refRel === rel) continue; // the declaration itself / same-file use
        // The import binding is a reference too, but it is not a usage — the
        // import edge already captured it.
        if (ref.getFirstAncestor((a) => Node.isImportDeclaration(a))) continue;
        const key = `${refRel}|${name}`;
        if (callSeen.has(key)) continue;
        callSeen.add(key);
        edges.push({
          fromFile: refRel,
          fromSymbol: enclosingSymbol(ref),
          toFile: rel,
          toSymbol: name,
          kind: 'call',
        });
      }
    }
  }

  return { units, facts: { files, edges } };
}
