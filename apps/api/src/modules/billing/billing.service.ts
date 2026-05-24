import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, sellers, users } from '../../db/schema.js';
import { PLAN_LIMITS, type Plan } from '../../config/plans.js';
import { AppError } from '../../middleware/error.js';

function usageStat(used: number, limit: number) {
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return { used, limit, pct, unlimited: limit === -1 };
}

export class BillingService {
  async getUsage(sellerId: string) {
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId) });
    if (!seller) throw new AppError('Shop not found', 404);

    const plan = seller.plan as Plan;
    const limits = PLAN_LIMITS[plan];

    const [[{ custCount }], [{ staffCount }], [{ instCount }]] = await Promise.all([
      db.select({ custCount: sql<number>`count(*)::int` }).from(customers)
        .where(and(eq(customers.sellerId, sellerId), isNull(customers.deletedAt))),
      db.select({ staffCount: sql<number>`count(*)::int` }).from(users)
        .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF'))),
      db.select({ instCount: sql<number>`count(*)::int` }).from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), isNull(installments.deletedAt))),
    ]);

    const now = new Date();
    const trialExpired   = seller.plan === 'TRIAL'      && seller.trialEndsAt   != null && seller.trialEndsAt   < now;
    const planExpired    = seller.plan !== 'TRIAL'      && seller.planExpiresAt != null && seller.planExpiresAt < now;
    const trialDaysLeft  = seller.trialEndsAt
      ? Math.max(0, Math.ceil((seller.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
      : null;

    return {
      plan,
      planLabel:     limits.label,
      priceMonthly:  limits.priceMonthly,
      trialEndsAt:   seller.trialEndsAt,
      planExpiresAt: seller.planExpiresAt,
      trialDaysLeft,
      trialExpired,
      planExpired,
      isActive:      seller.isActive,
      limits: {
        customers:    usageStat(custCount,  limits.customers),
        staff:        usageStat(staffCount, limits.staff),
        installments: usageStat(instCount,  limits.installments),
      },
    };
  }

  async changePlan(sellerId: string, body: { plan: Plan; planExpiresAt?: string }) {
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId) });
    if (!seller) throw new AppError('Shop not found', 404);

    const [updated] = await db
      .update(sellers)
      .set({
        plan:          body.plan,
        planExpiresAt: body.planExpiresAt ? new Date(body.planExpiresAt) : null,
        ...(body.plan === 'TRIAL' && { trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }),
      })
      .where(eq(sellers.id, sellerId))
      .returning();

    return updated;
  }
}
