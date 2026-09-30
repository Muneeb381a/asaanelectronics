import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { CustomerCreditsService } from './customer-credits.service.js';
import { success } from '../../utils/response.js';

const svc = new CustomerCreditsService();

export async function getCredit(req: AuthRequest, res: Response) {
  const customerId = req.params['customerId']!;
  const sellerId = req.user!.sellerId!;
  const [balance, history] = await Promise.all([
    svc.getBalance(customerId, sellerId),
    svc.listHistory(customerId, sellerId),
  ]);
  success(res, { balance, history });
}

export async function applyCredit(req: AuthRequest, res: Response) {
  const result = await svc.apply(req.params['customerId']!, req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result);
}
