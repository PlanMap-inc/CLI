import type { Node } from '../model';

/**
 * Dual-view projection: the `.planmap` JSON store is canonical; markdown is a
 * derived, one-way view (JSON always wins). These functions are pure — the
 * surface/store decides where to write the output.
 */

/** Render a single node as a markdown section. */
export function nodeToMarkdown(node: Node, titleOf: (id: string) => string | undefined): string {
  const tags = node.lens_tags.length > 0 ? node.lens_tags.join(', ') : '—';
  const body = node.summary ?? node.intent ?? '';
  const lines: string[] = [`### ${node.title}  ·  \`${node.status}\`  ·  ${tags}`, ''];

  if (body) {
    lines.push(body, '');
  }

  const parentTitle = node.parent ? (titleOf(node.parent) ?? node.parent) : '—';
  lines.push(`- **Parent:** ${parentTitle}`);

  if (node.depends_on.length > 0) {
    lines.push(`- **Depends on:** ${node.depends_on.map((id) => titleOf(id) ?? id).join(', ')}`);
  }
  if (node.linked_code.length > 0) {
    const code = node.linked_code
      .map((link) => `\`${link.path}:${link.range[0]}–${link.range[1]}\``)
      .join(', ');
    lines.push(`- **Code:** ${code}`);
  }
  if (node.annotation) {
    lines.push(`- **Why:** ${node.annotation}`);
  }
  if ((node.status === 'drifted' || node.status === 'error') && node.drift) {
    const label = node.status === 'error' ? '✕ Error' : '⚠ Drifted';
    lines.push(`- **${label}:** ${node.drift.issue}`);
  }

  return lines.join('\n');
}

/**
 * Render a set of nodes as one markdown document, walking the containment tree
 * (roots first, children under them) in a deterministic, title-sorted order so
 * that editing one node produces a small, localized diff.
 */
export function graphToMarkdown(nodes: Node[], rootTitle = 'PlanMap'): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const titleOf = (id: string): string | undefined => byId.get(id)?.title;
  const childrenOf = (parentId: string): Node[] =>
    nodes.filter((n) => n.parent === parentId).sort((a, b) => a.title.localeCompare(b.title));

  const isRoot = (n: Node): boolean => n.parent === null || !byId.has(n.parent);
  const roots = nodes.filter(isRoot).sort((a, b) => a.title.localeCompare(b.title));

  const rendered = new Set<string>();
  const sections: string[] = [`# ${rootTitle}`, ''];
  const renderSubtree = (node: Node): void => {
    if (rendered.has(node.id)) return;
    rendered.add(node.id);
    sections.push(nodeToMarkdown(node, titleOf), '');
    for (const child of childrenOf(node.id)) renderSubtree(child);
  };
  for (const root of roots) renderSubtree(root);

  return `${sections.join('\n').trimEnd()}\n`;
}
