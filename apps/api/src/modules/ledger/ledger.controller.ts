import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { LedgerService } from './ledger.service.js';
import { success } from '../../utils/response.js';

const svc = new LedgerService();

export async function getWalletBalance(req: AuthRequest, res: Response) {
  success(res, await svc.walletBalance(req.user!.sellerId!));
}

export async function getCashBook(req: AuthRequest, res: Response) {
  const { from, to, limit } = req.query as Record<string, string>;
  success(res, await svc.cashBook(req.user!.sellerId!, from, to, Math.min(Math.max(1, Number(limit) || 100), 500)));
}

export async function getDailySummary(req: AuthRequest, res: Response) {
  success(res, await svc.dailySummary(req.user!.sellerId!, req.query['date'] as string));
}

export async function getProfitLoss(req: AuthRequest, res: Response) {
  const { from, to } = req.query as Record<string, string>;
  success(res, await svc.profitLoss(req.user!.sellerId!, from, to));
}
