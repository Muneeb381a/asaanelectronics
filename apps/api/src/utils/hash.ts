import { createHash, createHmac } from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// Legacy: SHA-256(normalized + pepper) — kept only for zero-downtime migration reads
function hashCnicLegacy(cnic: string): string {
  const normalized = cnic.replace(/-/g, '');
  return createHash('sha256').update(normalized + env.CNIC_HASH_PEPPER).digest('hex');
}

// Current: HMAC-SHA256 — proper keyed PRF, pepper is the key not a string prefix
export function hashCnic(cnic: string): string {
  const normalized = cnic.replace(/-/g, '');
  return createHmac('sha256', env.CNIC_HASH_PEPPER).update(normalized).digest('hex');
}

// Returns [hmacHash, legacyHash] — use both for lookup, upgrade on match
export function hashCnicBoth(cnic: string): [string, string] {
  return [hashCnic(cnic), hashCnicLegacy(cnic)];
}

export function maskCnic(cnic: string) {
  const clean = cnic.replace(/-/g, '');
  return `XXXXX-XXXXXXX-${clean.slice(-1)}`;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Refresh tokens are stored hashed so a DB read alone cannot hijack a session.
// Every code path that inserts into `refreshTokens` must use this — see
// tokenMatches() in auth.service.ts for the read side (accepts old raw-stored
// rows too, for sessions issued before a given path adopted hashing).
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
