import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export function hashCnic(cnic: string) {
  const normalized = cnic.replace(/-/g, '');
  return createHash('sha256').update(normalized + env.CNIC_HASH_PEPPER).digest('hex');
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
