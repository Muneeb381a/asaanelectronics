import { and, asc, count, desc, eq, gte, isNull, lt, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, customers, expenses, installments, payments, products, recoveryActions, sellers } from '../../db/schema.js';
import type { SQL } from 'drizzle-orm';

// ── In-memory TTL cache (per-process, survives request boundaries) ─────────────
const _statsCache = new Map<string, { at: number; data: unknown }>();

async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const e = _statsCache.get(key);
  if (e && (Date.now() - e.at) < ttlMs) return e.data as T;
  const result = await fn();
  _statsCache.set(key, { at: Date.now(), data: result });
  return result;
}

// Clears all stats cache entries for a seller — call after any mutation that
// affects todayCollections / monthCollections / todayCashSales / monthCashSales.
export function clearSellerStatsCache(sellerId: string): void {
  for (const key of _statsCache.keys()) {
    if (key.startsWith(`stats:${sellerId}`)) _statsCache.delete(key);
  }
}

export class StatsService {
  async getReports(sellerId: string) {
    return withCache(`reports:${sellerId}`, 60_000, () => this._getReports(sellerId));
  }

  private async _getReports(sellerId: string) {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const dueExpr: SQL = sql`(CASE WHEN ${installments.paymentFrequency} = 'daily'
      THEN ${installments.startDate} + (${installments.months} || ' days')::interval
      ELSE ${installments.startDate} + (${installments.months} || ' months')::interval
    END)`;

    const [monthlyRaw, monthlyCashRaw, collectionData, agingData, topDebtors, topProducts] = await Promise.all([
      db
        .select({
          month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${payments.paidOn}), 'YYYY-MM')`,
          total: sum(payments.amount),
        })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          gte(payments.paidOn, twelveMonthsAgo),
          isNull(payments.deletedAt),
          isNull(installments.deletedAt),
          isNull(customers.deletedAt),
        ))
        .groupBy(sql`DATE_TRUNC('month', ${payments.paidOn})`)
        .orderBy(sql`DATE_TRUNC('month', ${payments.paidOn})`),

      db
        .select({
          month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${cashSales.createdAt}), 'YYYY-MM')`,
          total: sum(cashSales.amount),
        })
        .from(cashSales)
        .where(and(
          eq(cashSales.sellerId, sellerId),
          gte(cashSales.createdAt, twelveMonthsAgo),
        ))
        .groupBy(sql`DATE_TRUNC('month', ${cashSales.createdAt})`)
        .orderBy(sql`DATE_TRUNC('month', ${cashSales.createdAt})`),

      db
        .select({ totalBilled: sum(installments.totalAmount), totalRemaining: sum(installments.remaining) })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), isNull(installments.deletedAt), isNull(customers.deletedAt))),

      db
        .select({
          current:    sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} >= NOW())`,
          days0_7:    sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() AND ${dueExpr} >= NOW() - INTERVAL '7 days')`,
          days8_30:   sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() - INTERVAL '7 days' AND ${dueExpr} >= NOW() - INTERVAL '30 days')`,
          days31_90:  sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() - INTERVAL '30 days' AND ${dueExpr} >= NOW() - INTERVAL '90 days')`,
          days90plus: sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() - INTERVAL '90 days')`,
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), eq(installments.status, 'ACTIVE'), isNull(installments.deletedAt), isNull(customers.deletedAt))),

      db
        .select({
          name: customers.name,
          phone: customers.phone,
          remaining: sum(installments.remaining),
          count: count(),
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), eq(installments.status, 'ACTIVE'), isNull(installments.deletedAt), isNull(customers.deletedAt)))
        .groupBy(customers.id, customers.name, customers.phone)
        .orderBy(desc(sum(installments.remaining)))
        .limit(8),

      db
        .select({ name: products.name, totalAmount: sum(installments.totalAmount), count: count() })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .innerJoin(products, eq(installments.productId, products.id))
        .where(and(eq(customers.sellerId, sellerId), isNull(installments.deletedAt), isNull(customers.deletedAt), isNull(products.deletedAt)))
        .groupBy(products.name)
        .orderBy(desc(count()))
        .limit(6),
    ]);

    // Fill all 12 months (missing months = 0); combine installment payments + cash sales
    const instMap = new Map(monthlyRaw.map((r) => [r.month, Number(r.total ?? 0)]));
    const cashMap = new Map(monthlyCashRaw.map((r) => [r.month, Number(r.total ?? 0)]));
    const monthlyCollections = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
      return {
        month: key,
        label,
        total:       (instMap.get(key) ?? 0) + (cashMap.get(key) ?? 0),
        installments: instMap.get(key) ?? 0,
        cashSales:    cashMap.get(key) ?? 0,
      };
    });

    const totalBilled = Number(collectionData[0]?.totalBilled ?? 0);
    const totalRemaining = Number(collectionData[0]?.totalRemaining ?? 0);
    const totalCollected = totalBilled - totalRemaining;
    const rate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    const a = agingData[0] ?? { current: 0, days0_7: 0, days8_30: 0, days31_90: 0, days90plus: 0 };

    return {
      monthlyCollections,
      collectionRate: { totalBilled, totalCollected, rate },
      agingBuckets: {
        current:    Number(a.current),
        days0_7:    Number(a.days0_7),
        days8_30:   Number(a.days8_30),
        days31_90:  Number(a.days31_90),
        days90plus: Number(a.days90plus),
      },
      topDebtors: topDebtors.map((d) => ({
        name:      d.name,
        phone:     d.phone,
        remaining: Number(d.remaining ?? 0),
        count:     Number(d.count),
      })),
      topProducts: topProducts.map((p) => ({
        name:        p.name,
        totalAmount: Number(p.totalAmount ?? 0),
        count:       Number(p.count),
      })),
    };
  }

  async getStats(sellerId: string, userId?: string) {
    const key = userId ? `stats:${sellerId}:${userId}` : `stats:${sellerId}`;
    return withCache(key, 30_000, () => this._getStats(sellerId, userId));
  }

  private async _getStats(sellerId: string, userId?: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Staff: only run their own collections/sales — shop-wide metrics (active count,
    // overdue, low stock, promises) are not meaningful per-employee and are hidden.
    if (userId) {
      const [todayCollections, monthCollections, todayCashSales, monthCashSales] = await Promise.all([
        db.select({ total: sum(payments.amount) }).from(payments)
          .innerJoin(installments, eq(payments.installmentId, installments.id))
          .innerJoin(customers, eq(installments.customerId, customers.id))
          .where(and(eq(customers.sellerId, sellerId), gte(payments.paidOn, todayStart), lt(payments.paidOn, todayEnd), isNull(payments.deletedAt), isNull(installments.deletedAt), isNull(customers.deletedAt), eq(payments.collectedBy, userId))),
        db.select({ total: sum(payments.amount) }).from(payments)
          .innerJoin(installments, eq(payments.installmentId, installments.id))
          .innerJoin(customers, eq(installments.customerId, customers.id))
          .where(and(eq(customers.sellerId, sellerId), gte(payments.paidOn, monthStart), isNull(payments.deletedAt), isNull(installments.deletedAt), isNull(customers.deletedAt), eq(payments.collectedBy, userId))),
        db.select({ total: sum(cashSales.amount) }).from(cashSales)
          .where(and(eq(cashSales.sellerId, sellerId), gte(cashSales.createdAt, todayStart), lt(cashSales.createdAt, todayEnd), eq(cashSales.soldByUserId, userId))),
        db.select({ total: sum(cashSales.amount) }).from(cashSales)
          .where(and(eq(cashSales.sellerId, sellerId), gte(cashSales.createdAt, monthStart), eq(cashSales.soldByUserId, userId))),
      ]);
      return {
        todayCollections: Number(todayCollections[0]?.total ?? 0),
        monthCollections: Number(monthCollections[0]?.total ?? 0),
        todayCashSales:   Number(todayCashSales[0]?.total   ?? 0),
        monthCashSales:   Number(monthCashSales[0]?.total   ?? 0),
        activeCount:        0,
        overdueCount:       0,
        overdueAmount:      0,
        recentInstallments: [],
        lowStockItems:      [],
        promisesDueCount:   0,
        guarantorRiskCount: 0,
        budgetAlertsCount:  0,
      };
    }

    const [todayCollections, monthCollections, todayCashSales, monthCashSales, activeCount, overdueCount, recent, lowStockItems, promisesData, guarantorRisk, sellerRow, monthExpenses] = await Promise.all([
      db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          gte(payments.paidOn, todayStart),
          lt(payments.paidOn, todayEnd),
          isNull(payments.deletedAt),
          isNull(installments.deletedAt),
          isNull(customers.deletedAt),
          ...(userId ? [eq(payments.collectedBy, userId)] : []),
        )),

      db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          gte(payments.paidOn, monthStart),
          isNull(payments.deletedAt),
          isNull(installments.deletedAt),
          isNull(customers.deletedAt),
          ...(userId ? [eq(payments.collectedBy, userId)] : []),
        )),

      db
        .select({ total: sum(cashSales.amount) })
        .from(cashSales)
        .where(and(
          eq(cashSales.sellerId, sellerId),
          gte(cashSales.createdAt, todayStart),
          lt(cashSales.createdAt, todayEnd),
          ...(userId ? [eq(cashSales.soldByUserId, userId)] : []),
        )),

      db
        .select({ total: sum(cashSales.amount) })
        .from(cashSales)
        .where(and(
          eq(cashSales.sellerId, sellerId),
          gte(cashSales.createdAt, monthStart),
          ...(userId ? [eq(cashSales.soldByUserId, userId)] : []),
        )),

      db
        .select({ total: count() })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), eq(installments.status, 'ACTIVE'), isNull(installments.deletedAt), isNull(customers.deletedAt))),

      db
        .select({ total: count(), amount: sum(installments.remaining) })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          eq(installments.status, 'ACTIVE'),
          isNull(installments.deletedAt),
          isNull(customers.deletedAt),
          sql`(
            CASE WHEN ${installments.paymentFrequency} = 'daily'
              THEN ${installments.startDate} + (
                (GREATEST(0, FLOOR(
                  (${installments.totalAmount}::numeric - ${installments.downPayment}::numeric - ${installments.remaining}::numeric)
                  / NULLIF(${installments.monthly}::numeric, 0)
                )) + 1) || ' days'
              )::interval
              ELSE ${installments.startDate} + (
                (GREATEST(0, FLOOR(
                  (${installments.totalAmount}::numeric - ${installments.downPayment}::numeric - ${installments.remaining}::numeric)
                  / NULLIF(${installments.monthly}::numeric, 0)
                )) + 1) || ' months'
              )::interval
            END
          ) < now()`,
        )),

      db
        .select({
          id: installments.id,
          customerName: customers.name,
          productName: products.name,
          remaining: installments.remaining,
          monthly: installments.monthly,
          status: installments.status,
          createdAt: installments.createdAt,
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .innerJoin(products, eq(installments.productId, products.id))
        .where(and(eq(customers.sellerId, sellerId), isNull(installments.deletedAt), isNull(customers.deletedAt), isNull(products.deletedAt)))
        .orderBy(desc(installments.createdAt))
        .limit(5),

      db
        .select({ id: products.id, name: products.name, stock: products.stock, minStock: products.minStock })
        .from(products)
        .where(and(eq(products.sellerId, sellerId), sql`${products.stock} <= ${products.minStock}`, isNull(products.deletedAt)))
        .orderBy(asc(products.stock))
        .limit(10),

      db
        .select({ total: count() })
        .from(recoveryActions)
        .where(and(
          eq(recoveryActions.sellerId, sellerId),
          eq(recoveryActions.type, 'PROMISE_TO_PAY'),
          sql`${recoveryActions.promiseDate} IS NOT NULL`,
          sql`${recoveryActions.promiseDate}::date <= NOW()::date`,
        )),

      // Guarantors whose OWN installment is overdue (SA3)
      db.execute<{ total: string }>(sql`
        SELECT COUNT(DISTINCT g.id)::text AS total
        FROM customers g
        INNER JOIN installments gi
          ON gi.customer_id = g.id
          AND gi.status = 'ACTIVE'
          AND gi.deleted_at IS NULL
        INNER JOIN customers borrower
          ON (borrower.guarantor_phone = g.phone OR borrower.guarantor2_phone = g.phone)
          AND borrower.seller_id = ${sellerId}
          AND borrower.deleted_at IS NULL
        INNER JOIN installments bi
          ON bi.customer_id = borrower.id
          AND bi.status = 'ACTIVE'
          AND bi.deleted_at IS NULL
        WHERE g.seller_id = ${sellerId}
          AND g.deleted_at IS NULL
          AND g.phone IS NOT NULL
          AND (
            CASE WHEN gi.payment_frequency = 'daily' THEN
              gi.start_date + ((GREATEST(0, FLOOR(
                (gi.total_amount::numeric - gi.down_payment::numeric - gi.remaining::numeric)
                / NULLIF(gi.monthly::numeric, 0)
              )) + 1) || ' days')::interval
            ELSE
              DATE_TRUNC('month', gi.start_date + ((GREATEST(0, FLOOR(
                (gi.total_amount::numeric - gi.down_payment::numeric - gi.remaining::numeric)
                / NULLIF(gi.monthly::numeric, 0)
              )) + 1) || ' months')::interval)::date + (gi.payment_due_day - 1)
            END
          ) < NOW()
      `),

      // Budget check: seller settings
      db.query.sellers.findFirst({
        where: eq(sellers.id, sellerId),
        columns: { settings: true },
      }),

      // Budget check: current month expenses by category
      db
        .select({ category: expenses.category, total: sum(expenses.amount) })
        .from(expenses)
        .where(and(
          eq(expenses.sellerId, sellerId),
          gte(expenses.date, monthStart as unknown as Date),
        ))
        .groupBy(expenses.category),
    ]);

    const budgetLimits = (sellerRow?.settings?.expenseBudgets ?? {}) as Partial<Record<string, number>>;
    const spentByCat: Record<string, number> = {};
    for (const row of monthExpenses) { spentByCat[row.category] = Number(row.total ?? 0); }
    const budgetAlertsCount = Object.entries(budgetLimits).filter(([cat, limit]) =>
      limit && limit > 0 && (spentByCat[cat] ?? 0) >= limit,
    ).length;

    return {
      todayCollections: Number(todayCollections[0]?.total ?? 0),
      monthCollections: Number(monthCollections[0]?.total ?? 0),
      todayCashSales:   Number(todayCashSales[0]?.total   ?? 0),
      monthCashSales:   Number(monthCashSales[0]?.total   ?? 0),
      activeCount:   Number(activeCount[0]?.total  ?? 0),
      overdueCount:  Number(overdueCount[0]?.total  ?? 0),
      overdueAmount: Number(overdueCount[0]?.amount ?? 0),
      recentInstallments: recent,
      lowStockItems,
      promisesDueCount:    Number(promisesData[0]?.total ?? 0),
      guarantorRiskCount:  Number((guarantorRisk[0] as { total: string } | undefined)?.total ?? 0),
      budgetAlertsCount,
    };
  }

  async getAdvanced(sellerId: string) {
    return withCache(`advanced:${sellerId}`, 120_000, () => this._getAdvanced(sellerId));
  }

  private async _getAdvanced(sellerId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86_400_000);

    const [activeInstRows, recoveryRows, staffRows, areaRows] = await Promise.all([
      // Cashflow forecast: fetch active installments, compute due dates in JS (avoids CROSS JOIN LATERAL generate_series)
      db.execute<{
        start_date: string; months: number; monthly: string;
        payment_frequency: string; payment_due_day: number;
        remaining: string; total_amount: string; down_payment: string;
      }>(sql`
        SELECT i.start_date, i.months, i.monthly, i.payment_frequency, i.payment_due_day,
               i.remaining, i.total_amount, i.down_payment
        FROM installments i
        INNER JOIN customers c ON i.customer_id = c.id
        WHERE c.seller_id = ${sellerId}
          AND c.deleted_at IS NULL
          AND i.status = 'ACTIVE'
          AND i.deleted_at IS NULL
      `),

      // Recovery efficiency: overdue + defaulted installments
      db.execute<{ total_due: number; total_collected: number; overdue_count: number }>(sql`
        SELECT
          COALESCE(SUM(i.total_amount - i.down_payment), 0)::numeric               AS total_due,
          COALESCE(SUM(i.total_amount - i.down_payment - i.remaining), 0)::numeric  AS total_collected,
          COUNT(*)::int                                                              AS overdue_count
        FROM installments i
        INNER JOIN customers c ON i.customer_id = c.id
        WHERE c.seller_id = ${sellerId}
          AND c.deleted_at IS NULL
          AND i.deleted_at IS NULL
          AND (
            i.status = 'DEFAULTED'
            OR (i.status = 'ACTIVE' AND (CASE WHEN i.payment_frequency = 'daily'
              THEN i.start_date + (i.months || ' days')::interval
              ELSE i.start_date + (i.months || ' months')::interval
            END) < NOW())
          )
      `),

      // Staff productivity: payments recorded per user, last 30 days
      db.execute<{ user_id: string; name: string; count: number; total: number }>(sql`
        SELECT
          al.user_id,
          u.name,
          COUNT(*)::int                              AS count,
          COALESCE(SUM(p.amount), 0)::numeric        AS total
        FROM audit_logs al
        INNER JOIN users u ON u.id = al.user_id
        LEFT  JOIN payments p ON p.id = al.entity_id AND p.deleted_at IS NULL
        WHERE al.seller_id = ${sellerId}
          AND al.action    = 'PAYMENT_RECORDED'
          AND al.created_at >= ${thirtyDaysAgo}
        GROUP BY al.user_id, u.name
        ORDER BY count DESC
        LIMIT 10
      `),

      // Area heatmap: overdue customers grouped by city (last comma-separated part of address)
      db.execute<{ city: string; overdue_count: number; defaulted_count: number }>(sql`
        SELECT
          COALESCE(NULLIF(TRIM(SPLIT_PART(c.address, ',', -1)), ''), 'Unknown') AS city,
          COUNT(DISTINCT CASE WHEN i.status = 'ACTIVE'
            AND (CASE WHEN i.payment_frequency = 'daily'
              THEN i.start_date + (i.months || ' days')::interval
              ELSE i.start_date + (i.months || ' months')::interval
            END) < NOW() THEN c.id END)::int   AS overdue_count,
          COUNT(DISTINCT CASE WHEN i.status = 'DEFAULTED' THEN c.id END)::int               AS defaulted_count
        FROM customers c
        LEFT JOIN installments i ON i.customer_id = c.id AND i.deleted_at IS NULL
        WHERE c.seller_id = ${sellerId}
          AND c.deleted_at IS NULL
          AND (
            (i.status = 'ACTIVE' AND (CASE WHEN i.payment_frequency = 'daily'
              THEN i.start_date + (i.months || ' days')::interval
              ELSE i.start_date + (i.months || ' months')::interval
            END) < NOW())
            OR i.status = 'DEFAULTED'
          )
        GROUP BY city
        HAVING COUNT(DISTINCT c.id) > 0
        ORDER BY (overdue_count + defaulted_count) DESC
        LIMIT 10
      `),
    ]);

    // Compute cashflow forecast in JS — avoids CROSS JOIN LATERAL generate_series(1, months) expansion
    const cashflowMap = new Map<string, number>();
    for (const inst of activeInstRows) {
      const startDate  = new Date(inst.start_date);
      const monthly    = Number(inst.monthly);
      const remaining  = Number(inst.remaining);
      const paidAmt    = Number(inst.total_amount) - Number(inst.down_payment) - remaining;
      const paidPeriods = monthly > 0 ? Math.max(0, Math.floor(paidAmt / monthly + 0.001)) : 0;
      const isDaily    = inst.payment_frequency === 'daily';
      const dueDay     = Number(inst.payment_due_day) || 10;

      for (let n = paidPeriods + 1; n <= inst.months; n++) {
        let dueDate: Date;
        if (isDaily) {
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + n);
        } else {
          const yr      = startDate.getFullYear();
          const mo      = startDate.getMonth() + n;
          const lastDay = new Date(yr, mo + 1, 0).getDate();
          dueDate = new Date(yr, mo, Math.min(dueDay, lastDay));
        }
        if (dueDate > thirtyDaysLater) break;
        if (dueDate >= now) {
          const key = dueDate.toISOString().slice(0, 10);
          cashflowMap.set(key, (cashflowMap.get(key) ?? 0) + monthly);
        }
      }
    }
    const cashflowRows = Array.from(cashflowMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([due_date, expected]) => ({ due_date, expected }));

    const r = recoveryRows[0] ?? { total_due: 0, total_collected: 0, overdue_count: 0 };
    const totalDue       = Number(r.total_due);
    const totalCollected = Number(r.total_collected);
    const efficiency     = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

    return {
      cashflowForecast: cashflowRows.map((row) => ({
        date:     row.due_date,
        expected: Number(row.expected),
      })),
      recovery: {
        efficiency,
        totalDue,
        totalCollected,
        overdueCount: Number(r.overdue_count),
      },
      staffProductivity: staffRows.map((row) => ({
        userId: row.user_id,
        name:   row.name,
        count:  Number(row.count),
        total:  Number(row.total),
      })),
      areaHeatmap: areaRows.map((row) => ({
        city:          row.city,
        overdueCount:  Number(row.overdue_count),
        defaultedCount: Number(row.defaulted_count),
      })),
    };
  }

  async getDailyBriefing(sellerId: string) {
    const rows = await db.execute<{
      due_today: number;
      overdue_total: number;
      promises_today: number;
      collected_today: string;
      defaulted_count: number;
    }>(sql`
      WITH today AS (SELECT CURRENT_DATE AS d),
      overdue_expr AS (
        SELECT i.id,
          CASE WHEN i.payment_frequency = 'daily'
            THEN i.start_date + (
              (GREATEST(0, FLOOR(
                (i.total_amount::numeric - i.down_payment::numeric - i.remaining::numeric)
                / NULLIF(i.monthly::numeric, 0)
              )) + 1) || ' days'
            )::interval
            ELSE DATE_TRUNC('month', i.start_date + (
              (GREATEST(0, FLOOR(
                (i.total_amount::numeric - i.down_payment::numeric - i.remaining::numeric)
                / NULLIF(i.monthly::numeric, 0)
              )) + 1) || ' months'
            )::interval)::date + (i.payment_due_day - 1)
          END AS next_due
        FROM installments i
        INNER JOIN customers c ON c.id = i.customer_id
        WHERE c.seller_id = ${sellerId}
          AND i.status = 'ACTIVE'
          AND i.deleted_at IS NULL
          AND c.deleted_at IS NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE DATE(oe.next_due) = (SELECT d FROM today))::int             AS due_today,
        COUNT(*) FILTER (WHERE oe.next_due < NOW())::int                                   AS overdue_total,
        (
          SELECT COUNT(*)::int FROM recovery_actions ra
          WHERE ra.seller_id = ${sellerId}
            AND ra.type = 'PROMISE_TO_PAY'
            AND DATE(ra.promise_date) = (SELECT d FROM today)
        )                                                                                   AS promises_today,
        (
          SELECT COALESCE(SUM(p.amount::numeric), 0)::text
          FROM payments p
          INNER JOIN installments i2 ON p.installment_id = i2.id
          INNER JOIN customers c2    ON c2.id = i2.customer_id
          WHERE c2.seller_id = ${sellerId}
            AND DATE(p.paid_on) = (SELECT d FROM today)
            AND p.deleted_at IS NULL
        )                                                                                   AS collected_today,
        (
          SELECT COUNT(*)::int FROM installments i3
          INNER JOIN customers c3 ON c3.id = i3.customer_id
          WHERE c3.seller_id = ${sellerId}
            AND i3.status = 'DEFAULTED'
            AND i3.deleted_at IS NULL
        )                                                                                   AS defaulted_count
      FROM overdue_expr oe
    `);

    const r = rows[0] ?? { due_today: 0, overdue_total: 0, promises_today: 0, collected_today: '0', defaulted_count: 0 };
    return {
      dueToday:       Number(r.due_today),
      overdueTotal:   Number(r.overdue_total),
      promisesToday:  Number(r.promises_today),
      collectedToday: Number(r.collected_today),
      defaultedCount: Number(r.defaulted_count),
    };
  }
}
