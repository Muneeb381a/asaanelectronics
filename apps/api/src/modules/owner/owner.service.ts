import { eq, and, inArray, sql, desc, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  sellers, users, customers, products, installments, payments,
  verifications, recoveryActions, expenses, ledgerEntries, cashSales,
  auditLogs, returns, adminPaymentLogs, adminShopNotes, superAdminAuditLogs,
  refreshTokens,
} from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { hashPassword } from '../../utils/hash.js';
import { PLAN_LIMITS } from '../../config/plans.js';

export class OwnerService {
  // ── A10: Admin audit log helper ───────────────────────────────────────────

  private async logAdmin(
    actorId: string,
    action: string,
    sellerId?: string | null,
    shopName?: string | null,
    note?: string,
    meta?: Record<string, unknown>,
  ) {
    await db.insert(superAdminAuditLogs).values({
      actorId,
      action,
      sellerId: sellerId ?? null,
      shopName: shopName ?? null,
      note:     note ?? null,
      meta:     meta ?? null,
    });
  }

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

  async toggleShopStatus(id: string, isActive: boolean, actorId?: string) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true, shopName: true } });
    if (!shop) throw new AppError('Shop not found', 404);
    const [updated] = await db.update(sellers).set({ isActive }).where(eq(sellers.id, id)).returning();
    if (actorId) {
      void this.logAdmin(
        actorId,
        isActive ? 'SHOP_ACTIVATED' : 'SHOP_SUSPENDED',
        id,
        shop.shopName,
        `${isActive ? 'Activated' : 'Suspended'} shop "${shop.shopName}"`,
      );
    }
    return updated;
  }

  async createShop(body: { shopName: string; phone: string; address?: string; plan?: 'TRIAL' | 'BASIC' | 'PRO' }, actorId?: string) {
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
    if (actorId && seller) {
      void this.logAdmin(actorId, 'SHOP_CREATED', seller.id, seller.shopName,
        `Created shop "${seller.shopName}" on plan ${seller.plan}`,
        { phone: seller.phone, plan: seller.plan });
    }
    return seller;
  }

  async createShopOwner(sellerId: string, body: { name: string; email: string; password: string }, actorId?: string) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true, shopName: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email), columns: { id: true } });
    if (existing) throw new AppError('Email already registered', 409);

    const password = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({ name: body.name, email: body.email, password, role: 'SELLER_OWNER', sellerId })
      .returning();

    if (actorId) {
      void this.logAdmin(actorId, 'SHOP_OWNER_CREATED', sellerId, shop.shopName,
        `Created owner account "${body.name}" (${body.email}) for "${shop.shopName}"`);
    }
    return { id: user!.id, name: user!.name, email: user!.email, sellerId: user!.sellerId };
  }

  async deleteShop(id: string, actorId?: string) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true, shopName: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    // Log before deletion so seller_id reference still exists
    if (actorId) {
      await this.logAdmin(actorId, 'SHOP_DELETED', null, shop.shopName,
        `Permanently deleted shop "${shop.shopName}" and all its data`);
    }

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
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true, shopName: true } });
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

    void this.logAdmin(loggedBy, 'PAYMENT_LOG_ADDED', sellerId, shop.shopName,
      `Logged PKR ${body.amount} via ${body.method} for "${shop.shopName}"${body.forMonth ? ` (${body.forMonth})` : ''}`,
      { amount: body.amount, method: body.method, reference: body.reference, forMonth: body.forMonth });

    return row!;
  }

  async deletePaymentLog(id: string, actorId?: string) {
    const existing = await db.query.adminPaymentLogs.findFirst({
      where: eq(adminPaymentLogs.id, id),
      columns: { id: true, sellerId: true, amount: true },
    });
    if (!existing) throw new AppError('Payment log not found', 404);
    await db.delete(adminPaymentLogs).where(eq(adminPaymentLogs.id, id));
    if (actorId) {
      void this.logAdmin(actorId, 'PAYMENT_LOG_DELETED', existing.sellerId, null,
        `Deleted payment log PKR ${existing.amount}`);
    }
    return { deleted: true };
  }

  // ── A7: Shop internal notes ────────────────────────────────────────────────

  async addShopNote(sellerId: string, createdBy: string, content: string) {
    if (!content?.trim()) throw new AppError('Note content is required', 400);
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true, shopName: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const [row] = await db.insert(adminShopNotes).values({
      sellerId,
      content: content.trim(),
      createdBy,
    }).returning();

    void this.logAdmin(createdBy, 'NOTE_ADDED', sellerId, shop.shopName,
      `Added note to "${shop.shopName}": ${content.trim().slice(0, 60)}`);

    return row!;
  }

  async deleteShopNote(id: string, actorId?: string) {
    const existing = await db.query.adminShopNotes.findFirst({
      where: eq(adminShopNotes.id, id),
      columns: { id: true, sellerId: true },
    });
    if (!existing) throw new AppError('Note not found', 404);
    await db.delete(adminShopNotes).where(eq(adminShopNotes.id, id));
    if (actorId) {
      void this.logAdmin(actorId, 'NOTE_DELETED', existing.sellerId, null, 'Deleted internal note');
    }
    return { deleted: true };
  }

  // ── Session management ─────────────────────────────────────────────────────

  async getShopSessions(sellerId: string) {
    // Verify shop exists
    const shop = await db.query.sellers.findFirst({
      where: eq(sellers.id, sellerId),
      columns: { id: true, shopName: true },
    });
    if (!shop) throw new AppError('Shop not found', 404);

    const now = new Date();

    // All active (non-expired) sessions for any user belonging to this shop
    const rows = await db
      .select({
        sessionId:    refreshTokens.id,
        userId:       refreshTokens.userId,
        ip:           refreshTokens.ip,
        deviceName:   refreshTokens.deviceName,
        deviceType:   refreshTokens.deviceType,
        lastActiveAt: refreshTokens.lastActiveAt,
        isSuspicious: refreshTokens.isSuspicious,
        createdAt:    refreshTokens.createdAt,
        expiresAt:    refreshTokens.expiresAt,
        userName:     users.name,
        userEmail:    users.email,
        userRole:     users.role,
      })
      .from(refreshTokens)
      .innerJoin(users, eq(users.id, refreshTokens.userId))
      .where(
        and(
          eq(users.sellerId, sellerId),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(refreshTokens.lastActiveAt));

    return { shopName: shop.shopName, sessions: rows };
  }

  async killSession(sessionId: string, actorId: string, actorSessionId?: string) {
    if (sessionId === actorSessionId) {
      throw new AppError('Cannot kill your own active session', 400);
    }

    // Fetch to verify it exists and log shopName
    const session = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.id, sessionId),
      columns: { id: true, userId: true },
    });
    if (!session) throw new AppError('Session not found', 404);

    // Get user → shop info for the audit log
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { name: true, email: true, sellerId: true },
    });

    const shop = user?.sellerId
      ? await db.query.sellers.findFirst({ where: eq(sellers.id, user.sellerId), columns: { shopName: true } })
      : null;

    await db.delete(refreshTokens).where(eq(refreshTokens.id, sessionId));

    void this.logAdmin(
      actorId,
      'SESSION_KILLED',
      user?.sellerId ?? null,
      shop?.shopName ?? null,
      `Killed session of ${user?.name ?? 'unknown'} (${user?.email ?? ''})`,
      { sessionId, userId: session.userId },
    );
  }

  async killAllShopSessions(sellerId: string, actorId: string, actorSessionId?: string) {
    const shop = await db.query.sellers.findFirst({
      where: eq(sellers.id, sellerId),
      columns: { id: true, shopName: true },
    });
    if (!shop) throw new AppError('Shop not found', 404);

    // Collect all user IDs for this shop
    const shopUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.sellerId, sellerId));

    const userIds = shopUsers.map((u) => u.id);
    if (userIds.length === 0) return { killed: 0 };

    // Delete all sessions for these users, except the admin's own session
    const deleted = await db
      .delete(refreshTokens)
      .where(
        and(
          inArray(refreshTokens.userId, userIds),
          // Safety: never delete the admin's own session
          actorSessionId ? sql`${refreshTokens.id} != ${actorSessionId}` : undefined,
        ),
      )
      .returning({ id: refreshTokens.id });

    const killed = deleted.length;

    void this.logAdmin(
      actorId,
      'ALL_SESSIONS_KILLED',
      sellerId,
      shop.shopName,
      `Force-logged out all ${killed} session(s) for "${shop.shopName}"`,
      { userCount: userIds.length, sessionsKilled: killed },
    );

    return { killed };
  }

  // ── B1: Churn Risk Score ──────────────────────────────────────────────────

  async getChurnScores() {
    const now       = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    type RawRow = {
      id: string; shopName: string; plan: string; isActive: boolean;
      trialEndsAt: Date | null; planExpiresAt: Date | null; createdAt: Date;
      ownerName: string | null; ownerEmail: string | null;
      customerCount: string; installmentCount: string;
      lastPaymentDate: Date | null; paymentsThisMonth: string;
    };

    const rows = await db.execute<RawRow>(sql`
      SELECT
        s.id,
        s.shop_name      AS "shopName",
        s.plan,
        s.is_active      AS "isActive",
        s.trial_ends_at  AS "trialEndsAt",
        s.plan_expires_at AS "planExpiresAt",
        s.created_at     AS "createdAt",
        u.name           AS "ownerName",
        u.email          AS "ownerEmail",
        COALESCE(cust.cnt,  0)::text AS "customerCount",
        COALESCE(inst.cnt,  0)::text AS "installmentCount",
        pay.last_payment_date        AS "lastPaymentDate",
        COALESCE(pay.this_month, 0)::text AS "paymentsThisMonth"
      FROM sellers s
      LEFT JOIN users u
        ON u.seller_id = s.id AND u.role = 'SELLER_OWNER'
      LEFT JOIN (
        SELECT seller_id, COUNT(*) AS cnt
        FROM customers WHERE deleted_at IS NULL
        GROUP BY seller_id
      ) cust ON cust.seller_id = s.id
      LEFT JOIN (
        SELECT c.seller_id, COUNT(i.id) AS cnt
        FROM installments i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.deleted_at IS NULL
        GROUP BY c.seller_id
      ) inst ON inst.seller_id = s.id
      LEFT JOIN (
        SELECT
          c.seller_id,
          MAX(p.paid_on) AS last_payment_date,
          COUNT(CASE WHEN p.paid_on >= ${monthStart} THEN 1 END) AS this_month
        FROM payments p
        JOIN installments i ON i.id = p.installment_id
        JOIN customers  c ON c.id = i.customer_id
        WHERE p.deleted_at IS NULL
        GROUP BY c.seller_id
      ) pay ON pay.seller_id = s.id
      ORDER BY s.created_at DESC
    `);

    return (rows as unknown as RawRow[]).map((r) => {
      const custCount      = Number(r.customerCount);
      const paysThisMonth  = Number(r.paymentsThisMonth);
      const limits         = PLAN_LIMITS[r.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.TRIAL;
      const shopAgeDays    = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86_400_000);
      const lastPay        = r.lastPaymentDate ? new Date(r.lastPaymentDate) : null;
      const daysSince      = lastPay ? Math.floor((now.getTime() - lastPay.getTime()) / 86_400_000) : null;

      const isExpired =
        (r.plan === 'TRIAL' && r.trialEndsAt && new Date(r.trialEndsAt) < now) ||
        (r.plan !== 'TRIAL' && r.planExpiresAt && new Date(r.planExpiresAt) < now);
      const hardBlocked =
        isExpired &&
        (() => {
          const expAt = r.plan === 'TRIAL' ? r.trialEndsAt : r.planExpiresAt;
          return expAt ? Math.floor((now.getTime() - new Date(expAt).getTime()) / 86_400_000) >= 3 : false;
        })();

      type Severity = 'positive' | 'low' | 'medium' | 'high';
      const factors: { key: string; label: string; points: number; severity: Severity }[] = [];
      let score = 0;

      const add = (key: string, label: string, pts: number, sev: Severity) => {
        factors.push({ key, label, points: pts, severity: sev });
        score += pts;
      };

      // ── New shop grace: ignore most signals ──────────────────────────────
      if (shopAgeDays < 7) {
        add('new_shop', `Shop created ${shopAgeDays}d ago — grace period`, -999, 'positive');
        return {
          shopId: r.id, shopName: r.shopName, ownerName: r.ownerName, ownerEmail: r.ownerEmail,
          plan: r.plan, isActive: r.isActive, score: 0, risk: 'healthy' as const,
          factors: [{ key: 'new_shop', label: `Shop created ${shopAgeDays}d ago — grace period`, points: 0, severity: 'positive' as Severity }],
          lastPaymentDate: lastPay?.toISOString() ?? null, daysSinceActivity: null,
          customerCount: custCount, paymentsThisMonth: paysThisMonth, shopAgeDays,
        };
      }

      // ── Activity signals ─────────────────────────────────────────────────
      if (custCount === 0) {
        add('no_customers', 'No customers ever added', 40, 'high');
      } else if (daysSince === null) {
        add('no_activity', 'Has customers but zero payments ever', 50, 'high');
      } else if (daysSince > 60) {
        add('inactive_60d', `No activity for ${daysSince} days`, 45, 'high');
      } else if (daysSince > 30) {
        add('inactive_30d', `No activity for ${daysSince} days`, 28, 'medium');
      } else if (daysSince > 14) {
        add('inactive_14d', `No activity for ${daysSince} days`, 12, 'low');
      }

      // ── Usage signals ─────────────────────────────────────────────────────
      const custLimit = limits.customers;
      const custPct   = custLimit <= 0 ? 100 : (custCount / custLimit) * 100;
      if (custCount > 0 && custPct < 10) {
        add('low_usage', `Only ${custCount} customers (${Math.round(custPct)}% of plan)`, 12, 'medium');
      } else if (custPct > 75) {
        add('high_usage', `${Math.round(custPct)}% plan capacity used`, -10, 'positive');
      }

      // ── Payment velocity this month ───────────────────────────────────────
      if (custCount >= 5 && paysThisMonth === 0) {
        add('zero_payments_month', 'Zero payments collected this month', 18, 'medium');
      } else if (paysThisMonth > 25) {
        add('high_velocity', `${paysThisMonth} payments collected this month`, -15, 'positive');
      }

      // ── Plan / account status ─────────────────────────────────────────────
      if (!r.isActive) {
        add('suspended', 'Shop is suspended', 30, 'high');
      } else if (hardBlocked) {
        add('expired', 'Plan expired (past grace period)', 20, 'high');
      } else if (isExpired) {
        add('in_grace', 'Plan expired — in 3-day grace period', 8, 'low');
      }

      // ── Long-term loyalty bonus ───────────────────────────────────────────
      if (shopAgeDays > 90 && r.plan !== 'TRIAL' && !isExpired && r.isActive) {
        add('loyal', `Paying customer for ${Math.floor(shopAgeDays / 30)}+ months`, -8, 'positive');
      }

      score = Math.max(0, Math.min(100, score));
      const risk = score <= 20 ? 'healthy' : score <= 50 ? 'at-risk' : 'churning';

      return {
        shopId: r.id, shopName: r.shopName, ownerName: r.ownerName, ownerEmail: r.ownerEmail,
        plan: r.plan, isActive: r.isActive, score, risk,
        factors: factors.filter((f) => f.key !== 'new_shop'),
        lastPaymentDate: lastPay?.toISOString() ?? null,
        daysSinceActivity: daysSince,
        customerCount: custCount,
        paymentsThisMonth: paysThisMonth,
        shopAgeDays,
      };
    });
  }

  // ── A10: List admin audit logs ─────────────────────────────────────────────

  async listAdminAuditLogs(sellerId?: string, limit = 100) {
    const rows = await db
      .select({
        id:        superAdminAuditLogs.id,
        action:    superAdminAuditLogs.action,
        sellerId:  superAdminAuditLogs.sellerId,
        shopName:  superAdminAuditLogs.shopName,
        note:      superAdminAuditLogs.note,
        meta:      superAdminAuditLogs.meta,
        createdAt: superAdminAuditLogs.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(superAdminAuditLogs)
      .leftJoin(users, eq(users.id, superAdminAuditLogs.actorId))
      .where(sellerId ? eq(superAdminAuditLogs.sellerId, sellerId) : undefined)
      .orderBy(desc(superAdminAuditLogs.createdAt))
      .limit(limit);

    return rows;
  }
}
