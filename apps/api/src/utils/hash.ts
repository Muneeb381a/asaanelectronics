import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
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

// Reversible AES-256-GCM, same layout as backups/r2.ts's encryptionKey() — a
// SHA-256-derived 32-byte key from one long operator passphrase, so the
// passphrase itself doesn't need to be exactly 32 raw bytes. Separate key
// from CNIC_HASH_PEPPER: that one can never be inverted, this one can, so it
// carries a much bigger blast radius if it ever leaks. Only customers
// created/edited after CNIC_ENCRYPTION_KEY was set have this populated —
// older rows only have cnicHash/cnicMasked and are unrecoverable by design.
const CNIC_IV_LEN  = 12;
const CNIC_TAG_LEN = 16;

export function cnicEncryptionConfigured(): boolean {
  return !!env.CNIC_ENCRYPTION_KEY;
}

function cnicEncryptionKey(): Buffer {
  return createHash('sha256').update(env.CNIC_ENCRYPTION_KEY!).digest();
}

export function encryptCnic(cnic: string): string {
  const iv = randomBytes(CNIC_IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', cnicEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(cnic, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptCnic(payload: string): string {
  const blob = Buffer.from(payload, 'base64');
  const iv  = blob.subarray(0, CNIC_IV_LEN);
  const tag = blob.subarray(CNIC_IV_LEN, CNIC_IV_LEN + CNIC_TAG_LEN);
  const ciphertext = blob.subarray(CNIC_IV_LEN + CNIC_TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', cnicEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
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
