import type { Request, Response, NextFunction } from 'express';
import { and, eq } from 'drizzle-orm';
import { verifyAccess } from '../utils/jwt.js';
import { AppError } from './error.js';
import { db } from '../db/index.js';
import { refreshTokens, users, sellers } from '../db/schema.js';

export interface AuthRequest extends Request {
  user?: { userId: string; sellerId: string | null; role: string; sessionId?: string };
  params: Record<string, string>;
}

// Revoked sessions / frozen users are cut off within SESSION_TTL_MS instead of
// at access-token expiry, without paying a DB round-trip on every request.
const SESSION_TTL_MS = 30_000;
type SessionCheck = { ok: true } | { ok: false; reason: string; code: number };
const sessionCache = new Map<string, { at: number; result: SessionCheck }>();

async function checkSession(sessionId: string, userId: string): Promise<SessionCheck> {
  const hit = sessionCache.get(sessionId);
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.result;

  const [row] = await db
    .select({
      id: refreshTokens.id,
      frozenUntil: users.frozenUntil,
      role: users.role,
      sellerIsActive: sellers.isActive,
      trialApprovalStatus: sellers.trialApprovalStatus,
    })
    .from(refreshTokens)
    .innerJoin(users, eq(users.id, refreshTokens.userId))
    .leftJoin(sellers, eq(sellers.id, users.sellerId))
    .where(and(eq(refreshTokens.id, sessionId), eq(refreshTokens.userId, userId)));

  let result: SessionCheck;
  if (!row) result = { ok: false, reason: 'Session expired. Please log in again.', code: 401 };
  else if (row.frozenUntil && row.frozenUntil > new Date()) result = { ok: false, reason: 'Account is frozen. Contact the shop owner.', code: 403 };
  // Seller-level checks don't apply to the platform admin (no sellerId).
  else if (row.role !== 'SUPER_ADMIN' && row.sellerIsActive === false)
    result = { ok: false, reason: 'Your shop account has been suspended. Contact the platform owner.', code: 403 };
  else if (row.role !== 'SUPER_ADMIN' && row.trialApprovalStatus === 'PENDING')
    result = { ok: false, reason: 'Your shop is awaiting approval from the platform admin. You will get access as soon as it is reviewed.', code: 403 };
  else if (row.role !== 'SUPER_ADMIN' && row.trialApprovalStatus === 'REJECTED')
    result = { ok: false, reason: 'Your trial request was declined. Contact support for details.', code: 403 };
  else result = { ok: true };

  if (sessionCache.size > 5000) sessionCache.clear();
  sessionCache.set(sessionId, { at: Date.now(), result });
  return result;
}

export function invalidateSessionCache(sessionId?: string): void {
  if (sessionId) sessionCache.delete(sessionId);
  else sessionCache.clear();
}

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next(new AppError('Unauthorized', 401));

  let payload: NonNullable<AuthRequest['user']>;
  try {
    payload = verifyAccess(token);
  } catch {
    return next(new AppError('Invalid token', 401));
  }

  if (payload.sessionId) {
    try {
      const s = await checkSession(payload.sessionId, payload.userId);
      if (!s.ok) return next(new AppError(s.reason, s.code));
    } catch (err) {
      return next(err);
    }
  }

  req.user = payload;
  next();
}

export function requireSeller(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user?.sellerId) return next(new AppError('Seller context required', 403));
  next();
}

export function requireSuperAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'SUPER_ADMIN') return next(new AppError('Forbidden', 403));
  next();
}

export function requireOwner(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'SELLER_OWNER') return next(new AppError('This action requires shop owner permissions', 403));
  next();
}
