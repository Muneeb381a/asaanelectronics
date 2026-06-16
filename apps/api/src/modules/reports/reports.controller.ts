import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ReportsService } from './reports.service.js';
import { success } from '../../utils/response.js';

const svc = new ReportsService();

export async function getMonthlyReport(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const year = parseInt(req.query['year'] as string) || new Date().getFullYear();
  if (year < 2020 || year > new Date().getFullYear() + 1) {
    res.status(400).json({ success: false, data: null, error: 'Invalid year' });
    return;
  }
  success(res, await svc.getMonthlyReport(sellerId, year));
}
