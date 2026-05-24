import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { BillingService } from './billing.service.js';
import { success } from '../../utils/response.js';
import type { Plan } from '../../config/plans.js';

const svc = new BillingService();

export async function getUsage(req: AuthRequest, res: Response) {
  success(res, await svc.getUsage(req.user!.sellerId!));
}

export async function changePlan(req: AuthRequest, res: Response) {
  const { plan, planExpiresAt } = req.body as { plan: Plan; planExpiresAt?: string };
  success(res, await svc.changePlan(req.params['sellerId']!, { plan, planExpiresAt }));
}
