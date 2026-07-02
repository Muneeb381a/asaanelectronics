import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  sellers, users, customers, products, installments, payments,
  verifications, recoveryActions, expenses, ledgerEntries, cashSales,
  auditLogs, returns, adminPaymentLogs, adminShopNotes,
} from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { hashPassword } from '../../utils/hash.js';
import { PLAN_LIMITS } from '../../config/plans.js';

export class OwnerService {
  // ── List / manage shops ────────────────────────────────────────────────────

  async listShops() {
    const rows = await db
      .select({
        id: sellers.id,
        shopName: sellers.shopName,
        phone: sellers.phone,
        address: sellers.address,
        plan: sellers.plan,
        isActive: sellers.isActive,
        trialEndsAt: sellers.trialEndsAt,
        planExpiresAt: sellers.planExpiresAt,
        createdAt: sellers.createdAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerId: users.id,
      })
      .from(sellers)
      .leftJoin(users, and(eq(users.sellerId, sellers.id), eq(users.role, 'SELLER_OWNER')));

    return rows;
  }

  async toggleShopStatus(id: string, isActive: boolean) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);
    const [updated] = await db.update(sellers).set({ isActive }).where(eq(sellers.id, id)).returning();
    return updated;
  }

  async createShop(body: { shopName: string; phone: string; address?: string; plan?: 'TRIAL' | 'BASIC' | 'PRO' }) {
    const [seller] = await db
      .insert(sellers)
      .values({
        shopName: body.shopName,
        phone: body.phone,
        address: body.address,
        plan: body.plan ?? 'TRIAL',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();
    return seller;
  }

  async createShopOwner(sellerId: string, body: { name: string; email: string; password: string }) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email), columns: { id: true } });
    if (existing) throw new AppError('Email already registered', 409);

    const password = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({ name: body.name, email: body.email, password, role: 'SELLER_OWNER', sellerId })
      .returning();

    return { id: user!.id, name: user!.name, email: user!.email, sellerId: user!.sellerId };
  }

  async deleteShop(id: string) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    await db.transaction(async (tx) => {
      const shopCustomers = await tx.select({ id: customers.id }).from(customers).where(eq(customers.sellerId, id));
      const customerIds = shopCustomers.map((c) => c.id);

      const installmentIds: string[] = [];
      if (customerIds.length > 0) {
        const shopInstallments = await tx.select({ id: installments.id }).from(installments)
          .where(inArray(installments.customerId, customerIds));
        installmentIds.push(...shopInstallments.map((i) => i.id));
      }

      if (customerIds.length > 0) await tx.delete(verifications).where(inArray(verifications.customerId, customerIds));
      await tx.delete(returns).where(eq(returns.sellerId, id));
      await tx.delete(recoveryActions).where(eq(recoveryActions.sellerId, id));
      if (installmentIds.length > 0) await tx.delete(payments).where(inArray(payments.installmentId, installmentIds));
      if (customerIds.length > 0) await tx.delete(installments).where(inArray(installments.customerId, customerIds));
      await tx.delete(customers).where(eq(customers.sellerId, id));
      await tx.delete(expenses).where(eq(expenses.sellerId, id));
      await tx.delete(ledgerEntries).where(eq(ledgerEntries.sellerId, id));
      await tx.delete(cashSales).where(eq(cashSales.sellerId, id));
      await tx.delete(auditLogs).where(eq(auditLogs.sellerId, id));
      await tx.delete(adminPaymentLogs).where(eq(adminPaymentLogs.sellerId, id));
      await tx.delete(adminShopNotes).where(eq(adminShopNotes.sellerId, id));
      await tx.delete(products).where(eq(products.sellerId, id));
      await tx.delete(users).where(eq(users.sellerId, id));
      await tx.delete(sellers).where(eq(sellers.id, id));
    });
  }

  // ── A1: Platform-wide dashboard stats ─────────────────────────────────────

  async getPlatformStats() {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const in7  = new Date(now.getTime() + 7  * 86_400_000);
    const in14 = new Date(now.getTime() + 14 * 86_400_000);
    const in30 = new Date(now.getTime() + 30 * 86_400_000);

    const allShops = await db
      .select({
        id: sellers.id, shopName: sellers.shopName, phone: sellers.phone,
        plan: sellers.plan, isActive: sellers.isActive,
        trialEndsAt: sellers.trialEndsAt, planExpiresAt: sellers.planExpiresAt,
        createdAt: sellers.createdAt,
        ownerName: users.name, ownerEmail: users.email,
      })
      .from(sellers)
      .leftJoin(users, and(eq(users.sellerId, sellers.id), eq(users.role, 'SELLER_OWNER')));

    const isExpired = (s: typeof allShops[0]) => {
      if (!s.isActive) return false; // suspended ≠ expired
      if (s.plan === 'TRIAL' && s.trialEndsAt && new Date(s.trialEndsAt) < now) return true;
      if (s.planExpiresAt && new Date(s.planExpiresAt) < now) return true;
      return false;
    };

    const activeShops    = allShops.filter((s) => s.isActive && !isExpired(s));
    const suspendedShops = allShops.filter((s) => !s.isActive);
    const expiredShops   = allShops.filter(isExpired);
    const trialShops     = allShops.filter((s) => s.plan === 'TRIAL' && s.isActive && !isExpired(s));
    const paidShops      = allShops.filter((s) => s.plan !== 'TRIAL' && s.isActive && !isExpired(s));
    const newThisMonth   = allShops.filter((s) => new Date(s.createdAt) >= monthStart);

    // Shops expiring within 7 days (trial or plan)
    const trialExpiring7 = allShops.filter((s) =>
      s.isActive && s.plan === 'TRIAL' && s.trialEndsAt &&
      new Date(s.trialEndsAt) >= today && new Date(s.trialEndsAt) <= in7
    );
    const planExpiring7 = allShops.filter((s) =>
      s.isActive && s.plan !== 'TRIAL' && s.planExpiresAt &&
      new Date(s.planExpiresAt) >= today && new Date(s.planExpiresAt) <= in7
    );
    const planExpiring14 = allShops.filter((s) =>
      s.isActive && s.plan !== 'TRIAL' && s.planExpiresAt &&
      new Date(s.planExpiresAt) >= today && new Date(s.planExpiresAt) <= in14
    );
    const planExpiring30 = allShops.filter((s) =>
      s.isActive && s.plan !== 'TRIAL' && s.planExpiresAt &&
      new Date(s.planExpiresAt) >= today && new Date(s.planExpiresAt) <= in30
    );

    // MRR from active paid shops
    const mrr = paidShops.reduce((sum, s) => {
      const price = PLAN_LIMITS[s.plan as keyof typeof PLAN_LIMITS]?.priceMonthly ?? 0;
      return sum + (price > 0 ? price : 0);
    }, 0);

    // Total revenue ever recorded (admin payment logs)
    const [revRes] = await db.execute<{ total: string }>(
      sql`SELECT COALESCE(SUM(amount), 0) AS total FROM admin_payment_logs`
    );
    const totalRevenueCollected = Number(revRes?.total ?? 0);

    // Revenue this month
    const [revMonthRes] = await db.execute<{ total: string }>(
      sql`SELECT COALESCE(SUM(amount), 0) AS total FROM admin_payment_logs WHERE created_at >= ${monthStart}`
    );
    const revenueThisMonth = Number(revMonthRes?.total ?? 0);

    // Total customers + installments across platform
    const [custRes] = await db.execute<{ total: string }>(sql`SELECT COUNT(*)::text AS total FROM customers`);
    const [instRes] = await db.execute<{ total: string }>(sql`SELECT COUNT(*)::text AS total FROM installments`);

    return {
      totalShops:    allShops.length,
      activeShops:   activeShops.length,
      suspendedShops: suspendedShops.length,
      expiredShops:  expiredShops.length,
      trialShops:    trialShops.length,
      paidShops:     paidShops.length,
      newThisMonth:  newThisMonth.length,
      mrr,
      totalRevenueCollected,
      revenueThisMonth,
      totalCustomers:    Number(custRes?.total ?? 0),
      totalInstallments: Number(instRes?.total ?? 0),
      // Expiry queues
      trialExpiring7,
      planExpiring7,
      planExpiring14,
      planExpiring30,
    };
  }

  // ── A3: Shop usage drill-in ────────────────────────────────────────────────

  async getShopUsage(sellerId: string) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId) });
    if (!shop) throw new AppError('Shop not found', 404);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      custRes, instRes, staffRes, paymentsMonthRes,
      revenueRes, lastPaymentRes, paymentLogs, notes,
    ] = await Promise.all([
      db.execute<{ total: string }>(sql`SELECT COUNT(*)::text AS total FROM customers WHERE seller_id = ${sellerId}`),
      db.execute<{ total: string }>(sql`SELECT COUNT(*)::text AS total FROM installments i JOIN customers c ON c.id = i.customer_id WHERE c.seller_id = ${sellerId}`),
      db.execute<{ total: string }>(sql`SELECT COUNT(*)::text AS total FROM users WHERE seller_id = ${sellerId} AND role = 'SELLER_STAFF'`),
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total FROM payments p
        JOIN installments i ON i.id = p.installment_id
        JOIN customers c ON c.id = i.customer_id
        WHERE c.seller_id = ${sellerId} AND p.paid_on >= ${monthStart} AND p.deleted_at IS NULL
      `),
      db.execute<{ total: string }>(sql`
        SELECT COALESCE(SUM(p.amount), 0)::text AS total FROM payments p
        JOIN installments i ON i.id = p.installment_id
        JOIN customers c ON c.id = i.customer_id
        WHERE c.seller_id = ${sellerId} AND p.deleted_at IS NULL
      `),
      db.execute<{ date: Date | null }>(sql`
        SELECT MAX(p.paid_on) AS date FROM payments p
        JOIN installments i ON i.id = p.installment_id
        JOIN customers c ON c.id = i.customer_id
        WHERE c.seller_id = ${sellerId} AND p.deleted_at IS NULL
      `),
      db.select().from(adminPaymentLogs)
        .where(eq(adminPaymentLogs.sellerId, sellerId))
        .orderBy(desc(adminPaymentLogs.createdAt))
        .limit(20),
      db.select().from(adminShopNotes)
        .where(eq(adminShopNotes.sellerId, sellerId))
        .orderBy(desc(adminShopNotes.createdAt)),
    ]);

    return {
      shop,
      usage: {
        customers:      Number(custRes[0]?.total ?? 0),
        installments:   Number(instRes[0]?.total ?? 0),
        staff:          Number(staffRes[0]?.total ?? 0),
        paymentsThisMonth: Number(paymentsMonthRes[0]?.total ?? 0),
        totalRevenue:   Number(revenueRes[0]?.total ?? 0),
        lastActivity:   lastPaymentRes[0]?.date ?? null,
      },
      limits: PLAN_LIMITS[shop.plan as keyof typeof PLAN_LIMITS],
      paymentLogs,
      notes,
    };
  }

  // ── A4: Manual payment logs ────────────────────────────────────────────────

  async listPaymentLogs(sellerId?: string) {
    const q = db.select({
      id: adminPaymentLogs.id,
      sellerId: adminPaymentLogs.sellerId,
      amount: adminPaymentLogs.amount,
      method: adminPaymentLogs.method,
      reference: adminPaymentLogs.reference,
      forMonth: adminPaymentLogs.forMonth,
      note: adminPaymentLogs.note,
      createdAt: adminPaymentLogs.createdAt,
      shopName: sellers.shopName,
    })
    .from(adminPaymentLogs)
    .leftJoin(sellers, eq(sellers.id, adminPaymentLogs.sellerId))
    .orderBy(desc(adminPaymentLogs.createdAt));

    if (sellerId) {
      return q.where(eq(adminPaymentLogs.sellerId, sellerId));
    }
    return q;
  }

  async addPaymentLog(sellerId: string, loggedBy: string, body: {
    amount: number; method: string; reference?: string; forMonth?: string; note?: string;
  }) {
    if (!body.amount || body.amount <= 0) throw new AppError('Amount must be > 0', 400);
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const [row] = await db.insert(adminPaymentLogs).values({
      sellerId,
      amount: String(body.amount),
      method: body.method ?? 'BANK',
      reference: body.reference?.trim() || undefined,
      forMonth: body.forMonth?.trim() || undefined,
      note: body.note?.trim() || undefined,
      loggedBy,
    }).returning();
    return row!;
  }

  async deletePaymentLog(id: string) {
    const existing = await db.query.adminPaymentLogs.findFirst({
      where: eq(adminPaymentLogs.id, id),
      columns: { id: true },
    });
    if (!existing) throw new AppError('Payment log not found', 404);
    await db.delete(adminPaymentLogs).where(eq(adminPaymentLogs.id, id));
    return { deleted: true };
  }

  // ── A7: Shop internal notes ────────────────────────────────────────────────

  async addShopNote(sellerId: string, createdBy: string, content: string) {
    if (!content?.trim()) throw new AppError('Note content is required', 400);
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const [row] = await db.insert(adminShopNotes).values({
      sellerId,
      content: content.trim(),
      createdBy,
    }).returning();
    return row!;
  }

  async deleteShopNote(id: string) {
    const existing = await db.query.adminShopNotes.findFirst({
      where: eq(adminShopNotes.id, id),
      columns: { id: true },
    });
    if (!existing) throw new AppError('Note not found', 404);
    await db.delete(adminShopNotes).where(eq(adminShopNotes.id, id));
    return { deleted: true };
  }
}
