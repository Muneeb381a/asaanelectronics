import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { OwnerService } from '../owner/owner.service.js';
import { success } from '../../utils/response.js';

const svc = new OwnerService();

export async function getActiveBroadcasts(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId ?? null;
  success(res, await svc.getActiveBroadcasts(sellerId));
}
