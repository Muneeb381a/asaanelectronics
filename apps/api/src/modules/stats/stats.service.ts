import { and, asc, count, desc, eq, gte, isNull, lt, lte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, customers, installments, payments, products, recoveryActions } from '../../db/schema.js';
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
          current:   sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} >= NOW())`,
          days1_30:  sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() AND ${dueExpr} >= NOW() - INTERVAL '30 days')`,
          days31_60: sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() - INTERVAL '30 days' AND ${dueExpr} >= NOW() - INTERVAL '60 days')`,
          days60plus:sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() - INTERVAL '60 days')`,
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

    const a = agingData[0] ?? { current: 0, days1_30: 0, days31_60: 0, days60plus: 0 };

    return {
      monthlyCollections,
      collectionRate: { totalBilled, totalCollected, rate },
      agingBuckets: {
        current:    Number(a.current),
        days1_30:   Number(a.days1_30),
        days31_60:  Number(a.days31_60),
        days60plus: Number(a.days60plus),
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

    const LOW_STOCK = 3;

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
        activeCount:       0,
        overdueCount:      0,
        overdueAmount:     0,
        recentInstallments: [],
        lowStockItems:     [],
        promisesDueCount:  0,
      };
    }

    const [todayCollections, monthCollections, todayCashSales, monthCashSales, activeCount, overdueCount, recent, lowStockItems, promisesData] = await Promise.all([
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
        .select({ id: products.id, name: products.name, stock: products.stock })
        .from(products)
        .where(and(eq(products.sellerId, sellerId), lte(products.stock, LOW_STOCK), isNull(products.deletedAt)))
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
    ]);

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
      promisesDueCount: Number(promisesData[0]?.total ?? 0),
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
}
