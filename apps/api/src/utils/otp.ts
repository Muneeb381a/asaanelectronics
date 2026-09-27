import { createHash, randomInt, timingSafeEqual } from 'crypto';

export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function verifyOtp(code: string, hash: string): boolean {
  // Both are hex SHA-256 digests, always 64 chars — timingSafeEqual throws on a
  // length mismatch, so guard that first rather than let a malformed hash 500.
  const a = Buffer.from(hashOtp(code));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
