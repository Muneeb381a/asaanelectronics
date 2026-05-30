import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { VerificationsService } from './verifications.service.js';

const svc = new VerificationsService();

export async function myQueue(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page  = Math.max(1, Number(req.query['page'])  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query['limit']) || 50));
    res.json({ success: true, data: await svc.myQueue(req.user!.userId, req.user!.sellerId!, page, limit) });
  } catch (e) { next(e); }
}

export async function submitVerification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.submit(req.params['id']!, req.user!.userId, req.user!.sellerId!, req.body) });
  } catch (e) { next(e); }
}

export async function getReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getReport(req.params['id']!, req.user!.sellerId!) });
  } catch (e) { next(e); }
}

export async function reVerifyCustomer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.reVerify(req.params['id']!, req.user!.sellerId!) });
  } catch (e) { next(e); }
}

export async function avoStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.avoStats(req.user!.sellerId!) });
  } catch (e) { next(e); }
}
