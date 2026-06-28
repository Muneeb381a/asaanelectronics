import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { HandoversService } from './handovers.service.js';
import { success } from '../../utils/response.js';

const svc = new HandoversService();

export async function listHandovers(req: AuthRequest, res: Response) {
  const { staffId, date } = req.query as Record<string, string>;
  const effectiveStaffId = req.user!.role === 'SELLER_STAFF' ? req.user!.userId : staffId;
  success(res, await svc.list(req.user!.sellerId!, effectiveStaffId, date));
}

export async function getCollectedToday(req: AuthRequest, res: Response) {
  const staffId = req.user!.role === 'SELLER_STAFF' ? req.user!.userId : (req.query['staffId'] as string);
  if (!staffId) return success(res, { collected: 0 });
  const collected = await svc.collectedToday(req.user!.sellerId!, staffId);
  success(res, { collected });
}

export async function createHandover(req: AuthRequest, res: Response) {
  const row = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, row, 201);
}

export async function confirmHandover(req: AuthRequest, res: Response) {
  const row = await svc.confirm(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body);
  success(res, row);
}

export async function disputeHandover(req: AuthRequest, res: Response) {
  const row = await svc.dispute(req.params['id']!, req.user!.sellerId!, req.body?.ownerNote);
  success(res, row);
}
