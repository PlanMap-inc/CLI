import type { Node } from '../model';

import type { AffectedItem, RiskFlag } from './types';

const RISK_PATTERNS: ReadonlyArray<readonly [RiskFlag, RegExp]> = [
  ['auth', /(auth|login|logout|session|token|jwt|oauth|password|credential|authoriz|permission)/i],
  ['payments', /(payment|stripe|checkout|billing|invoice|charge|subscription|refund|paypal)/i],
  ['user_data', /(user|profile|account|email|address|\bpii\b|personal[_-]?data)/i],
  ['migrations', /(migration|migrate|schema|alter[_\s]?table|drop[_\s]?table)/i],
];

/**
 * Rule-based risk classification over the edited node and the affected paths.
 * Deterministic and LLM-free — flagging risk is a decision, and the LLM never
 * decides. A flag fires when auth / payments / user-data / migration surface
 * appears in the node title, its linked paths, its lens tags, or any affected path.
 */
export function classifyRisk(editedNode: Node, affected: AffectedItem[]): RiskFlag[] {
  const haystack = [
    editedNode.title,
    ...(editedNode.linked_code ?? []).map((link) => link.path),
    ...(editedNode.lens_tags ?? []),
    ...affected.map((item) => item.path),
  ]
    .join(' ')
    .toLowerCase();

  const flags: RiskFlag[] = [];
  for (const [flag, pattern] of RISK_PATTERNS) {
    if (pattern.test(haystack)) flags.push(flag);
  }
  return flags;
}
