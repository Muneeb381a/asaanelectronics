import { eq, and, sql, inArray, gte, lte, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import {
  users, sellers, refreshTokens, payments, customers, installments,
  commissionPayments, salaryPayments, cashSales, products,
  DEFAULT_STAFF_PERMISSIONS, type StaffPermissions,
} from '../../db/schema.js';
export type { StaffPermissions };
import { AppError } from '../../middleware/error.js';
import { PLAN_LIMITS, isUnlimited } from '../../config/plans.js';

export class StaffService {
  async list(sellerId: string) {
    return db
      .select({
        id:             users.id,
        name:           users.name,
        email:          users.email,
        role:           users.role,
        permissions:    users.permissions,
        frozenUntil:    users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary:  users.monthlySalary,
        createdAt:      users.createdAt,
      })
      .from(users)
      .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));
  }

  async create(sellerId: string, body: { name: string; email: string; password: string; permissions?: StaffPermissions }) {
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { plan: true } });
    const limit = PLAN_LIMITS[seller?.plan ?? 'TRIAL'].staff;
    if (!isUnlimited(limit)) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
        .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));
      if (count >= limit) throw new AppError(`Staff limit reached (${limit} on ${seller?.plan ?? 'TRIAL'} plan). Please upgrade.`, 402);
    }

    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) throw new AppError('Email already in use', 409);

    const hash = await bcrypt.hash(body.password, 10);
    const [staff] = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        password: hash,
        role: 'SELLER_STAFF',
        sellerId,
        permissions: body.permissions ?? DEFAULT_STAFF_PERMISSIONS,
      })
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    return staff;
  }

  async updatePermissions(id: string, sellerId: string, permissions: Partial<StaffPermissions>) {
    const [updated] = await db
      .update(users)
      .set({
        permissions: sql`(COALESCE(${users.permissions}::jsonb, '{}'::jsonb) || ${JSON.stringify(permissions)}::jsonb)::json`,
      })
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    return updated;
  }

  async updateProfile(id: string, sellerId: string, body: { commissionRate?: number | null; monthlySalary?: number | null }) {
    const set: Record<string, unknown> = {};
    if (body.commissionRate !== undefined) set['commissionRate'] = body.commissionRate;
    if (body.monthlySalary  !== undefined) set['monthlySalary']  = body.monthlySalary;

    const [updated] = await db
      .update(users)
      .set(set)
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    return updated;
  }

  async remove(id: string, sellerId: string) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
    });
    if (!member) throw new AppError('Staff member not found', 404);
    await db.delete(users).where(eq(users.id, id));
  }

  async freeze(id: string, sellerId: string, durationMonths: number | 'permanent') {
    const frozenUntil = durationMonths === 'permanent'
      ? new Date('2099-12-31T23:59:59Z')
      : new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(users)
      .set({ frozenUntil })
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));
    return updated;
  }

  async unfreeze(id: string, sellerId: string) {
    const [updated] = await db
      .update(users)
      .set({ frozenUntil: null })
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    return updated;
  }

  async getOne(id: string, sellerId: string) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { id: true, name: true, email: true, role: true, permissions: true, frozenUntil: true },
    });
    if (!member) throw new AppError('Staff member not found', 404);
    return member;
  }

  async getPermissions(id: string, sellerId: string) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { permissions: true },
    });
    return member?.permissions ?? DEFAULT_STAFF_PERMISSIONS;
  }

  // ── Commission ────────────────────────────────────────────────────────────────

  async commissions(sellerId: string, month?: string) {
    const seller = await db.query.sellers.findFirst({
      where: eq(sellers.id, sellerId),
      columns: { settings: true },
    });
    const shopRate = (seller?.settings as { commissionRate?: number } | null)?.commissionRate ?? 0;

    const ref  = month ? new Date(month + '-01') : new Date();
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const to   = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const monthLabel = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

    // Fetch collections grouped by staff
    const rows = await db.execute<{ userId: string; userName: string; total: string; count: number; perStaffRate: string | null }>(sql`
      SELECT
        p.collected_by                                          AS "userId",
        u.name                                                  AS "userName",
        COALESCE(SUM(p.amount::numeric), 0)::text               AS total,
        COUNT(*)::int                                           AS count,
        u.commission_rate::text                                 AS "perStaffRate"
      FROM payments p
      INNER JOIN users u        ON u.id = p.collected_by
      INNER JOIN installments i ON i.id = p.installment_id
      INNER JOIN customers c    ON c.id = i.customer_id
      WHERE c.seller_id = ${sellerId}
        AND p.deleted_at IS NULL
        AND p.paid_on >= ${from.toISOString()}
        AND p.paid_on <  ${to.toISOString()}
        AND p.collected_by IS NOT NULL
      GROUP BY p.collected_by, u.name, u.commission_rate
      ORDER BY total::numeric DESC
    `);

    // Fetch which staff already had commission paid this month
    const staffIds = rows.map((r) => r.userId);
    const paid = staffIds.length
      ? await db.select().from(commissionPayments)
          .where(and(
            eq(commissionPayments.sellerId, sellerId),
            eq(commissionPayments.month, monthLabel),
            inArray(commissionPayments.staffId, staffIds),
          ))
      : [];

    const paidMap = new Map(paid.map((p) => [p.staffId, p]));

    return {
      month: monthLabel,
      commissionRate: shopRate,
      staff: rows.map((r) => {
        const effectiveRate = r.perStaffRate !== null ? Number(r.perStaffRate) : shopRate;
        const collected     = Number(r.total);
        const commission    = effectiveRate > 0 ? Math.round(collected * (effectiveRate / 100)) : 0;
        const paidRecord    = paidMap.get(r.userId) ?? null;
        return {
          userId:         r.userId,
          userName:       r.userName,
          collected,
          payments:       Number(r.count),
          commissionRate: effectiveRate,
          commission,
          paid:           paidRecord ? {
            id:     paidRecord.id,
            amount: Number(paidRecord.amount),
            paidAt: paidRecord.paidAt,
            note:   paidRecord.note,
          } : null,
        };
      }),
    };
  }

  async payCommission(sellerId: string, paidById: string, body: { staffId: string; month: string; amount: number; note?: string }) {
    // Verify staff belongs to this seller
    const staff = await db.query.users.findFirst({
      where: and(eq(users.id, body.staffId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { id: true, name: true },
    });
    if (!staff) throw new AppError('Staff not found', 404);

    const { randomUUID } = await import('crypto');
    const [record] = await db
      .insert(commissionPayments)
      .values({
        id:       randomUUID(),
        sellerId,
        staffId:  body.staffId,
        month:    body.month,
        amount:   String(body.amount),
        paidById,
        note:     body.note ?? null,
      })
      .onConflictDoUpdate({
        target: [commissionPayments.sellerId, commissionPayments.staffId, commissionPayments.month],
        set: {
          amount:  String(body.amount),
          paidById,
          note:    body.note ?? null,
          paidAt:  new Date(),
        },
      })
      .returning();

    return record;
  }

  async deleteCommissionPayment(sellerId: string, staffId: string, month: string) {
    const [deleted] = await db
      .delete(commissionPayments)
      .where(and(
        eq(commissionPayments.sellerId, sellerId),
        eq(commissionPayments.staffId, staffId),
        eq(commissionPayments.month, month),
      ))
      .returning();
    if (!deleted) throw new AppError('Commission payment not found', 404);
    return deleted;
  }

  // ── Salary ────────────────────────────────────────────────────────────────────

  async listSalaries(sellerId: string, month?: string) {
    const ref  = month ? new Date(month + '-01') : new Date();
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const monthLabel = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

    const staffList = await this.list(sellerId);

    const paid = staffList.length
      ? await db.select().from(salaryPayments)
          .where(and(
            eq(salaryPayments.sellerId, sellerId),
            eq(salaryPayments.month, monthLabel),
            inArray(salaryPayments.staffId, staffList.map((s) => s.id)),
          ))
      : [];

    const paidMap = new Map(paid.map((p) => [p.staffId, p]));

    return {
      month: monthLabel,
      staff: staffList.map((s) => {
        const paidRecord = paidMap.get(s.id) ?? null;
        return {
          id:            s.id,
          name:          s.name,
          email:         s.email,
          monthlySalary: s.monthlySalary ? Number(s.monthlySalary) : null,
          paid:          paidRecord ? {
            id:     paidRecord.id,
            amount: Number(paidRecord.amount),
            paidAt: paidRecord.paidAt,
            note:   paidRecord.note,
          } : null,
        };
      }),
    };
  }

  async paySalary(sellerId: string, paidById: string, body: { staffId: string; month: string; amount: number; note?: string }) {
    const staff = await db.query.users.findFirst({
      where: and(eq(users.id, body.staffId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { id: true, name: true },
    });
    if (!staff) throw new AppError('Staff not found', 404);

    const { randomUUID } = await import('crypto');
    const [record] = await db
      .insert(salaryPayments)
      .values({
        id:       randomUUID(),
        sellerId,
        staffId:  body.staffId,
        month:    body.month,
        amount:   String(body.amount),
        paidById,
        note:     body.note ?? null,
      })
      .onConflictDoUpdate({
        target: [salaryPayments.sellerId, salaryPayments.staffId, salaryPayments.month],
        set: {
          amount:  String(body.amount),
          paidById,
          note:    body.note ?? null,
          paidAt:  new Date(),
        },
      })
      .returning();

    return record;
  }

  async deleteSalaryPayment(sellerId: string, staffId: string, month: string) {
    const [deleted] = await db
      .delete(salaryPayments)
      .where(and(
        eq(salaryPayments.sellerId, sellerId),
        eq(salaryPayments.staffId, staffId),
        eq(salaryPayments.month, month),
      ))
      .returning();
    if (!deleted) throw new AppError('Salary payment not found', 404);
    return deleted;
  }

  // ── Collections Report ────────────────────────────────────────────────────────

  // ── Daily Briefing ───────────────────────────────────────────────────────────

  async getBriefing(sellerId: string) {
    const seller = await db.query.sellers.findFirst({
      where: eq(sellers.id, sellerId),
      columns: { settings: true },
    });
    const targets = (seller?.settings?.staffTargets ?? {}) as Record<string, { daily?: number; monthly?: number }>;

    // PKT = UTC+5; compute today start, end, month start in UTC
    const nowUTC     = new Date();
    const offsetMs   = 5 * 60 * 60 * 1000;
    const nowPKT     = new Date(nowUTC.getTime() + offsetMs);
    const pktYMD     = nowPKT.toISOString().slice(0, 10);
    const todayStart = new Date(pktYMD + 'T00:00:00.000+05:00');
    const todayEnd   = new Date(pktYMD + 'T23:59:59.999+05:00');
    const monthStart = new Date(pktYMD.slice(0, 7) + '-01T00:00:00.000+05:00');

    const rows = await db.execute<{
      id:              string;
      name:            string;
      today_collected: string;
      today_count:     number;
      month_collected: string;
      month_count:     number;
    }>(sql`
      WITH today_stats AS (
        SELECT p.collected_by,
          COALESCE(SUM(p.amount::numeric), 0)::text AS today_collected,
          COUNT(*)::int                              AS today_count
        FROM payments p
        JOIN installments i ON i.id = p.installment_id
        JOIN customers c    ON c.id = i.customer_id
        WHERE c.seller_id = ${sellerId}
          AND p.deleted_at IS NULL
          AND p.paid_on >= ${todayStart.toISOString()}
          AND p.paid_on <  ${todayEnd.toISOString()}
          AND p.collected_by IS NOT NULL
        GROUP BY p.collected_by
      ),
      month_stats AS (
        SELECT p.collected_by,
          COALESCE(SUM(p.amount::numeric), 0)::text AS month_collected,
          COUNT(*)::int                              AS month_count
        FROM payments p
        JOIN installments i ON i.id = p.installment_id
        JOIN customers c    ON c.id = i.customer_id
        WHERE c.seller_id = ${sellerId}
          AND p.deleted_at IS NULL
          AND p.paid_on >= ${monthStart.toISOString()}
          AND p.collected_by IS NOT NULL
        GROUP BY p.collected_by
      )
      SELECT
        u.id,
        u.name,
        COALESCE(t.today_collected, '0') AS today_collected,
        COALESCE(t.today_count, 0)::int  AS today_count,
        COALESCE(m.month_collected, '0') AS month_collected,
        COALESCE(m.month_count, 0)::int  AS month_count
      FROM users u
      LEFT JOIN today_stats t ON t.collected_by = u.id
      LEFT JOIN month_stats m ON m.collected_by = u.id
      WHERE u.seller_id = ${sellerId}
        AND u.role = 'SELLER_STAFF'
      ORDER BY COALESCE(t.today_collected, '0')::numeric DESC, u.name
    `);

    return rows.map((r) => {
      const t = targets[r.id] ?? {};
      return {
        id:             r.id,
        name:           r.name,
        todayCollected: Number(r.today_collected),
        todayCount:     Number(r.today_count),
        monthCollected: Number(r.month_collected),
        monthCount:     Number(r.month_count),
        dailyTarget:    t.daily   ?? 0,
        monthlyTarget:  t.monthly ?? 0,
      };
    });
  }

  async setTarget(sellerId: string, staffId: string, target: { daily?: number; monthly?: number }) {
    const staff = await db.query.users.findFirst({
      where: and(eq(users.id, staffId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { id: true },
    });
    if (!staff) throw new AppError('Staff member not found', 404);

    const seller = await db.query.sellers.findFirst({
      where: eq(sellers.id, sellerId),
      columns: { settings: true },
    });
    const current  = seller?.settings ?? {};
    const existing = (current.staffTargets ?? {}) as Record<string, { daily?: number; monthly?: number }>;
    await db.update(sellers).set({
      settings: { ...current, staffTargets: { ...existing, [staffId]: target } },
    }).where(eq(sellers.id, sellerId));
    return target;
  }

  async collections(sellerId: string, from: string, to: string) {
    // Use PKT (UTC+5) local midnight so Pakistani morning payments aren't missed
    const fromDate = new Date(from + 'T00:00:00.000+05:00');
    const toDate   = new Date(to   + 'T23:59:59.999+05:00');

    // All staff for this seller (even those with zero collections show up)
    const allStaff = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));

    if (!allStaff.length) return { from, to, staff: [] };

    const staffIds = allStaff.map((s) => s.id);

    // Installment payments collected by staff in range
    const pymtRows = await db
      .select({
        id:            payments.id,
        amount:        payments.amount,
        method:        payments.method,
        paidOn:        payments.paidOn,
        note:          payments.note,
        collectedBy:   payments.collectedBy,
        customerName:  customers.name,
        customerPhone: customers.phone,
        customerId:    customers.id,
        installmentId: payments.installmentId,
      })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .where(and(
        eq(customers.sellerId, sellerId),
        isNull(payments.deletedAt),
        gte(payments.paidOn, fromDate),
        lte(payments.paidOn, toDate),
        inArray(payments.collectedBy as Parameters<typeof inArray>[0], staffIds),
      ))
      .orderBy(payments.paidOn);

    // Cash sales made by staff in range
    const saleRows = await db
      .select({
        id:           cashSales.id,
        amount:       cashSales.amount,
        method:       cashSales.method,
        createdAt:    cashSales.createdAt,
        note:         cashSales.note,
        soldBy:       cashSales.soldByUserId,
        customerName: cashSales.customerName,
        customerPhone:cashSales.customerPhone,
        productName:  products.name,
      })
      .from(cashSales)
      .innerJoin(products, eq(cashSales.productId, products.id))
      .where(and(
        eq(cashSales.sellerId, sellerId),
        gte(cashSales.createdAt, fromDate),
        lte(cashSales.createdAt, toDate),
        inArray(cashSales.soldByUserId as Parameters<typeof inArray>[0], staffIds),
      ))
      .orderBy(cashSales.createdAt);

    // Build per-staff result map
    type Entry =
      | { type: 'INSTALLMENT'; id: string; amount: number; method: string; date: Date; note: string | null; customerName: string; customerPhone: string; customerId: string; installmentId: string }
      | { type: 'CASH_SALE';   id: string; amount: number; method: string; date: Date; note: string | null; customerName: string | null; customerPhone: string | null; productName: string };

    const staffMap = new Map(allStaff.map((s) => [s.id, {
      userId:    s.id,
      userName:  s.name,
      summary: {
        installments: { count: 0, total: 0, cashTotal: 0, nonCashTotal: 0 },
        cashSales:    { count: 0, total: 0, cashTotal: 0, nonCashTotal: 0 },
        grandTotal:   0,
        needsHandover: 0,
      },
      entries: [] as Entry[],
    }]));

    for (const r of pymtRows) {
      const staff = staffMap.get(r.collectedBy!);
      if (!staff) continue;
      const amount = Number(r.amount);
      const isCash = r.method === 'CASH';
      staff.summary.installments.count++;
      staff.summary.installments.total    += amount;
      if (isCash) staff.summary.installments.cashTotal    += amount;
      else        staff.summary.installments.nonCashTotal += amount;
      staff.entries.push({
        type: 'INSTALLMENT', id: r.id, amount, method: r.method, date: r.paidOn,
        note: r.note, customerName: r.customerName, customerPhone: r.customerPhone,
        customerId: r.customerId, installmentId: r.installmentId,
      });
    }

    for (const r of saleRows) {
      const staff = staffMap.get(r.soldBy!);
      if (!staff) continue;
      const amount = Number(r.amount);
      const isCash = r.method === 'CASH';
      staff.summary.cashSales.count++;
      staff.summary.cashSales.total    += amount;
      if (isCash) staff.summary.cashSales.cashTotal    += amount;
      else        staff.summary.cashSales.nonCashTotal += amount;
      staff.entries.push({
        type: 'CASH_SALE', id: r.id, amount, method: r.method, date: r.createdAt,
        note: r.note, customerName: r.customerName, customerPhone: r.customerPhone,
        productName: r.productName,
      });
    }

    for (const staff of staffMap.values()) {
      staff.summary.grandTotal    = staff.summary.installments.total + staff.summary.cashSales.total;
      staff.summary.needsHandover = staff.summary.installments.cashTotal + staff.summary.cashSales.cashTotal;
      // Sort entries newest first
      staff.entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // Only return staff who have activity — owner can filter easily
    return {
      from,
      to,
      staff: Array.from(staffMap.values()).filter((s) => s.summary.grandTotal > 0),
    };
  }
}
