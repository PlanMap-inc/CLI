import type { Node } from '../model';

import type { ImpactResult } from '../impact';

/**
 * Compose the precise, impact-scoped instruction handed to the developer's own
 * coding agent. PlanMap never writes code — it tells the agent exactly what to
 * do and, crucially, which files it may touch, so the agent cannot wander off
 * and "fix" unrelated things.
 */
export function composeHandoff(node: Node, impact?: ImpactResult): string {
  const lines: string[] = [`# Task: ${node.title}`];

  const intent = node.intent ?? node.summary ?? '';
  if (intent) lines.push('', `**Intent:** ${intent}`);
  if (node.annotation) lines.push('', `**Why:** ${node.annotation}`);

  const files = new Set<string>();
  for (const link of node.linked_code) files.add(link.path);
  if (impact) for (const item of impact.affected) files.add(item.path);

  if (files.size > 0) {
    lines.push('', '**Scope — modify only these files:**');
    for (const file of [...files].sort((a, b) => a.localeCompare(b))) lines.push(`- ${file}`);
  }

  if (impact && impact.riskFlags.length > 0) {
    lines.push(
      '',
      `**Risk:** ${impact.riskFlags.join(', ')} — take extra care and do not break these.`,
    );
  }

  lines.push(
    '',
    'Do not modify anything outside the listed scope. PlanMap authored this plan; implement exactly it, then stop.',
  );

  return lines.join('\n');
}
