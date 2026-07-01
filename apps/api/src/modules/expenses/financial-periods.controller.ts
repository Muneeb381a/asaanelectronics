import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { FinancialPeriodsService } from './financial-periods.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';

const svc   = new FinancialPeriodsService();
const audit = new AuditService();

export async function listPeriods(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.user!.sellerId!));
}

export async function lockPeriod(req: AuthRequest, res: Response) {
  const year  = parseInt(req.params['year']!);
  const month = parseInt(req.params['month']!);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ message: 'Invalid year or month' });
    return;
  }
  const notes = req.body?.notes as string | undefined;
  const result = await svc.lock(req.user!.sellerId!, req.user!.userId, year, month, notes);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PERIOD_LOCKED', entityType: 'FINANCIAL_PERIOD', entityId: `${year}-${String(month).padStart(2,'0')}`,
    description: `Financial period ${month}/${year} locked`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function unlockPeriod(req: AuthRequest, res: Response) {
  const year  = parseInt(req.params['year']!);
  const month = parseInt(req.params['month']!);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ message: 'Invalid year or month' });
    return;
  }
  const result = await svc.unlock(req.user!.sellerId!, year, month);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PERIOD_UNLOCKED', entityType: 'FINANCIAL_PERIOD', entityId: `${year}-${String(month).padStart(2,'0')}`,
    description: `Financial period ${month}/${year} unlocked`,
    ...auditCtx(req),
  }).catch(console.error);
}
