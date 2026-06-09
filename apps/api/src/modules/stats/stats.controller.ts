import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { StatsService } from './stats.service.js';
import { success } from '../../utils/response.js';

const svc = new StatsService();

export async function getStats(req: AuthRequest, res: Response) {
  const user = req.user!;
  const staffUserId = user.role === 'SELLER_STAFF' ? user.userId : undefined;
  success(res, await svc.getStats(user.sellerId!, staffUserId));
}

export async function getReports(req: AuthRequest, res: Response) {
  success(res, await svc.getReports(req.user!.sellerId!));
}

export async function getAdvanced(req: AuthRequest, res: Response) {
  success(res, await svc.getAdvanced(req.user!.sellerId!));
}
