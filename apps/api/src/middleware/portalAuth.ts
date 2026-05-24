import type { Request, Response, NextFunction } from 'express';
import { verifyCustomerToken } from '../utils/jwt.js';
import { AppError } from './error.js';

export interface PortalRequest extends Request {
  customer?: { customerId: string; sellerId: string };
  params: Record<string, string>;
}

export function authenticateCustomer(req: PortalRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next(new AppError('Unauthorized', 401));
  try {
    const payload = verifyCustomerToken(token);
    if (payload.type !== 'CUSTOMER') return next(new AppError('Invalid token type', 401));
    req.customer = { customerId: payload.customerId, sellerId: payload.sellerId };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}
