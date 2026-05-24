import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { RecoveryService } from './recovery.service.js';
import { success } from '../../utils/response.js';

const svc = new RecoveryService();

export async function listRecoveryActions(req: AuthRequest, res: Response) {
  const installmentId = req.query['installmentId'] as string;
  if (!installmentId) {
    res.status(400).json({ success: false, data: null, error: 'installmentId required' });
    return;
  }
  success(res, await svc.list(installmentId, req.user!.sellerId!));
}

export async function createRecoveryAction(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.user!.userId, req.body), 201);
}

export async function deleteRecoveryAction(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, { deleted: true });
}
