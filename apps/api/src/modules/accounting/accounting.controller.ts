import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { AccountingService } from './accounting.service.js';
import { success } from '../../utils/response.js';

const svc = new AccountingService();

export async function getBalances(req: AuthRequest, res: Response) {
  success(res, await svc.getBalances(req.user!.sellerId!));
}

export async function listJournalEntries(req: AuthRequest, res: Response) {
  const { from, to, page, limit } = req.query as Record<string, string>;
  success(res, await svc.listJournalEntries(req.user!.sellerId!, {
    from, to,
    page:  page  ? Number(page)  : undefined,
    limit: limit ? Number(limit) : undefined,
  }));
}
