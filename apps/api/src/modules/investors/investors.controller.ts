import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { InvestorsService } from './investors.service.js';
import { success } from '../../utils/response.js';

const svc = new InvestorsService();

export async function listInvestors(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.user!.sellerId!));
}

export async function createInvestor(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.body), 201);
}

export async function updateInvestor(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.params['id']!, req.user!.sellerId!, req.body));
}

export async function deleteInvestor(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!, req.user!.userId);
  res.status(204).end();
}

export async function getInvestorLedger(req: AuthRequest, res: Response) {
  success(res, await svc.getLedger(req.params['id']!, req.user!.sellerId!));
}

// ── Contributions ────────────────────────────────────────────────────────────

export async function addContribution(req: AuthRequest, res: Response) {
  success(res, await svc.addContribution(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body), 201);
}

export async function removeContribution(req: AuthRequest, res: Response) {
  await svc.removeContribution(req.params['contribId']!, req.params['id']!, req.user!.sellerId!);
  res.status(204).end();
}

// ── Payouts ──────────────────────────────────────────────────────────────────

export async function recordPayout(req: AuthRequest, res: Response) {
  success(res, await svc.recordPayout(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body), 201);
}

export async function removePayout(req: AuthRequest, res: Response) {
  await svc.removePayout(req.params['payoutId']!, req.params['id']!, req.user!.sellerId!);
  res.status(204).end();
}
