import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { success } from '../../utils/response.js';
import * as svc from './agentPortfolio.service.js';

export async function getPortfolio(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { agentId } = req.query as { agentId?: string };
    success(res, await svc.listAgentPortfolio(req.user!.sellerId!, agentId));
  } catch (e) { next(e); }
}

export async function assign(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.assignCustomer(req.user!.sellerId!, req.user!.userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function unassign(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    success(res, await svc.unassignCustomer(req.params['id']!, req.user!.sellerId!));
  } catch (e) { next(e); }
}

export async function getDeductions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { staffId, month } = req.query as { staffId: string; month: string };
    if (!staffId || !month) throw new Error('staffId and month are required');
    success(res, await svc.listDeductions(req.user!.sellerId!, staffId, month));
  } catch (e) { next(e); }
}

export async function addDeduction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.addDeduction(req.user!.sellerId!, req.user!.userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteDeduction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    success(res, await svc.removeDeduction(req.params['id']!, req.user!.sellerId!));
  } catch (e) { next(e); }
}

export async function calculateDeductions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month } = req.body as { month: string };
    if (!month) throw new Error('month is required (e.g. "2026-08")');
    const data = await svc.calculateUncollectedDeductions(req.user!.sellerId!, req.user!.userId, month);
    success(res, data);
  } catch (e) { next(e); }
}

export async function getSalarySummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const month = (req.query['month'] as string) ?? currentMonth();
    success(res, await svc.salarySummary(req.user!.sellerId!, month));
  } catch (e) { next(e); }
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
