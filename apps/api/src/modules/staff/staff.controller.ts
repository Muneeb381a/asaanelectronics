import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { StaffService } from './staff.service.js';

const svc = new StaffService();

export async function listStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.list(req.user!.sellerId!);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.create(req.user!.sellerId!, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updatePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.updatePermissions(req.params['id']!, req.user!.sellerId!, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function removeStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await svc.remove(req.params['id']!, req.user!.sellerId!);
    res.json({ success: true, data: null });
  } catch (e) { next(e); }
}
