import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ReconciliationService } from './reconciliation.service.js';
import { success } from '../../utils/response.js';

const svc = new ReconciliationService();

export async function getLatest(req: AuthRequest, res: Response) {
  success(res, await svc.latestForSeller(req.user!.sellerId!));
}

export async function getHistory(req: AuthRequest, res: Response) {
  success(res, await svc.historyForSeller(req.user!.sellerId!));
}

export async function runNow(req: AuthRequest, res: Response) {
  const result = await svc.runForSeller(req.user!.sellerId!, 'MANUAL');
  success(res, result, 201);
}
