import { describe, expect, it } from 'vitest';

import { entitlements } from './index';

describe('entitlements', () => {
  it('Solo disables every Team/Org capability', () => {
    const e = entitlements('solo');
    expect(Object.values(e).every((flag) => flag === false)).toBe(true);
  });

  it('Team enables collaboration but not org governance', () => {
    const e = entitlements('team');
    expect(e.crossRepo).toBe(true);
    expect(e.approvalsMultiUser).toBe(true);
    expect(e.driftInCI).toBe(true);
    expect(e.agentDispatch).toBe(true);
    expect(e.crossLayer).toBe(false);
    expect(e.sso).toBe(false);
    expect(e.audit).toBe(false);
  });

  it('Org enables everything, including the cross-layer stitch and audit', () => {
    const e = entitlements('org');
    expect(Object.values(e).every((flag) => flag === true)).toBe(true);
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = entitlements('solo');
    a.crossRepo = true;
    expect(entitlements('solo').crossRepo).toBe(false);
  });
});
