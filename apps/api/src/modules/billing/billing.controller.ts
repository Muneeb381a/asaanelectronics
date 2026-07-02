import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { BillingService } from './billing.service.js';
import { success } from '../../utils/response.js';
import type { Plan } from '../../config/plans.js';
import { db } from '../../db/index.js';
import { sellers, superAdminAuditLogs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const svc = new BillingService();

export async function getUsage(req: AuthRequest, res: Response) {
  success(res, await svc.getUsage(req.user!.sellerId!));
}

export async function changePlan(req: AuthRequest, res: Response) {
  const sellerId = req.params['sellerId']!;
  const { plan, planExpiresAt } = req.body as { plan: Plan; planExpiresAt?: string };

  const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { shopName: true, plan: true } });
  const updated = await svc.changePlan(sellerId, { plan, planExpiresAt });

  // A10: log plan change
  void db.insert(superAdminAuditLogs).values({
    actorId:  req.user!.userId,
    action:   'PLAN_CHANGED',
    sellerId,
    shopName: shop?.shopName ?? null,
    note:     `Changed plan "${shop?.plan ?? '?'}" → "${plan}" for "${shop?.shopName ?? sellerId}"`,
    meta:     { oldPlan: shop?.plan, newPlan: plan, planExpiresAt: planExpiresAt ?? null },
  });

  success(res, updated);
}
