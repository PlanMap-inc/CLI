import { issueToken } from './jwt';

export function requestReset(userId: string): string {
  // Issues a fresh token so the user can set a new password.
  return issueToken(userId);
}
