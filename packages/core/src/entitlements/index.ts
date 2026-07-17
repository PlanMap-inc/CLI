/** The three PlanMap editions. */
export type Edition = 'solo' | 'team' | 'org';

/** Per-edition capability flags. One engine; features gated by flags, not forks. */
export interface Entitlements {
  /** Map and analyze across multiple repos. */
  crossRepo: boolean;
  /** Multi-user plan approval workflow. */
  approvalsMultiUser: boolean;
  /** Run drift verification as a CI gate. */
  driftInCI: boolean;
  /** The cross-layer (code + schema + cloud + CI) drift stitch. */
  crossLayer: boolean;
  /** Dispatch an agent to open an impact-gated PR. */
  agentDispatch: boolean;
  /** SSO / SAML. */
  sso: boolean;
  /** Audit logging. */
  audit: boolean;
}

const SOLO: Entitlements = {
  crossRepo: false,
  approvalsMultiUser: false,
  driftInCI: false,
  crossLayer: false,
  agentDispatch: false,
  sso: false,
  audit: false,
};

const TEAM: Entitlements = {
  ...SOLO,
  crossRepo: true,
  approvalsMultiUser: true,
  driftInCI: true,
  agentDispatch: true,
};

const ORG: Entitlements = {
  crossRepo: true,
  approvalsMultiUser: true,
  driftInCI: true,
  crossLayer: true,
  agentDispatch: true,
  sso: true,
  audit: true,
};

/**
 * Resolve the capability flags for an edition. In Milestone 1 only `solo`
 * ships, and every Team/Org capability resolves to `false` — so M2/M3 *unlock*
 * features rather than rewrite them.
 */
export function entitlements(edition: Edition): Entitlements {
  switch (edition) {
    case 'solo':
      return { ...SOLO };
    case 'team':
      return { ...TEAM };
    case 'org':
      return { ...ORG };
  }
}
