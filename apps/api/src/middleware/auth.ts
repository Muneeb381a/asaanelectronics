import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt.js';
import { AppError } from './error.js';

export interface AuthRequest extends Request {
  user?: { userId: string; sellerId: string | null; role: string; sessionId?: string };
  params: Record<string, string>;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next(new AppError('Unauthorized', 401));
  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    next(new AppError('Invalid token', 401));
  }
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
