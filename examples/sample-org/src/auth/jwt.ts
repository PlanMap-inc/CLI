export function verifyToken(token: string): boolean {
  return token.length > 10;
}

export function issueToken(userId: string): string {
  return `tok_${userId}_${Date.now()}`;
}
