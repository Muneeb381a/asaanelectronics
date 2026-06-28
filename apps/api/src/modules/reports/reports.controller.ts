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

export async function getAreaReport(req: AuthRequest, res: Response) {
  success(res, await svc.getAreaReport(req.user!.sellerId!));
}

export async function getAgingReport(req: AuthRequest, res: Response) {
  success(res, await svc.getAgingReport(req.user!.sellerId!));
}

export async function getMonthlyCustomers(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const now      = new Date();
  const year     = parseInt(req.query['year']  as string) || now.getFullYear();
  const month    = parseInt(req.query['month'] as string) || now.getMonth() + 1;
  if (year < 2020 || year > now.getFullYear() + 1 || month < 1 || month > 12) {
    res.status(400).json({ success: false, data: null, error: 'Invalid year or month' });
    return;
  }
  success(res, await svc.getMonthlyCustomers(sellerId, year, month));
}
