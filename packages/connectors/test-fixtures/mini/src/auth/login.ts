import { verifyToken } from './jwt';

export function login(token: string): boolean {
  return verifyToken(token);
}
