import { and, asc, count, desc, eq, gte, lt, lte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditLogs, customers, installments, payments, products, recoveryActions, users } from '../../db/schema.js';
import type { SQL } from 'drizzle-orm';

export class StatsService {
  async getReports(sellerId: string) {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const dueExpr: SQL = sql`(CASE WHEN ${installments.paymentFrequency} = 'daily'
      THEN ${installments.startDate} + (${installments.months} || ' days')::interval
      ELSE ${installments.startDate} + (${installments.months} || ' months')::interval
    END)`;

    const [monthlyRaw, collectionData, agingData, topDebtors, topProducts] = await Promise.all([
      db
        .select({
          month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${payments.paidOn}), 'YYYY-MM')`,
          total: sum(payments.amount),
        })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), gte(payments.paidOn, twelveMonthsAgo)))
        .groupBy(sql`DATE_TRUNC('month', ${payments.paidOn})`)
        .orderBy(sql`DATE_TRUNC('month', ${payments.paidOn})`),

      db
        .select({ totalBilled: sum(installments.totalAmount), totalRemaining: sum(installments.remaining) })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(eq(customers.sellerId, sellerId)),

      db
        .select({
          current:   sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} >= NOW())`,
          days1_30:  sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() AND ${dueExpr} >= NOW() - INTERVAL '30 days')`,
          days31_60: sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() - INTERVAL '30 days' AND ${dueExpr} >= NOW() - INTERVAL '60 days')`,
          days60plus:sql<number>`COUNT(*) FILTER (WHERE ${dueExpr} < NOW() - INTERVAL '60 days')`,
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), eq(installments.status, 'ACTIVE'))),

      db
        .select({
          name: customers.name,
          phone: customers.phone,
          remaining: sum(installments.remaining),
          count: count(),
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), eq(installments.status, 'ACTIVE')))
        .groupBy(customers.id, customers.name, customers.phone)
        .orderBy(desc(sum(installments.remaining)))
        .limit(8),

      db
        .select({ name: products.name, totalAmount: sum(installments.totalAmount), count: count() })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .innerJoin(products, eq(installments.productId, products.id))
        .where(eq(customers.sellerId, sellerId))
        .groupBy(products.name)
        .orderBy(desc(count()))
        .limit(6),
    ]);

    // Fill all 12 months (missing months = 0)
    const monthlyMap = new Map(monthlyRaw.map((r) => [r.month, Number(r.total ?? 0)]));
    const monthlyCollections = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
      return { month: key, label, total: monthlyMap.get(key) ?? 0 };
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

  async getStats(sellerId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const LOW_STOCK = 3;

    const [todayCollections, monthCollections, activeCount, overdueCount, recent, lowStockItems, promisesData] = await Promise.all([
      db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          gte(payments.paidOn, todayStart),
          lt(payments.paidOn, todayEnd),
        )),

      db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          gte(payments.paidOn, monthStart),
        )),

      db
        .select({ total: count() })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(customers.sellerId, sellerId), eq(installments.status, 'ACTIVE'))),

      db
        .select({ total: count() })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          eq(installments.status, 'ACTIVE'),
          sql`(CASE WHEN ${installments.paymentFrequency} = 'daily'
            THEN ${installments.startDate} + (${installments.months} || ' days')::interval
            ELSE ${installments.startDate} + (${installments.months} || ' months')::interval
          END) < now()`,
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
        .where(eq(customers.sellerId, sellerId))
        .orderBy(desc(installments.createdAt))
        .limit(5),

      db
        .select({ id: products.id, name: products.name, stock: products.stock })
        .from(products)
        .where(and(eq(products.sellerId, sellerId), lte(products.stock, LOW_STOCK)))
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
      activeCount: Number(activeCount[0]?.total ?? 0),
      overdueCount: Number(overdueCount[0]?.total ?? 0),
      recentInstallments: recent,
      lowStockItems,
      promisesDueCount: Number(promisesData[0]?.total ?? 0),
    };
  }

  async getAdvanced(sellerId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const [cashflowRows, recoveryRows, staffRows, areaRows] = await Promise.all([
      // Cashflow forecast: installment payment due dates in next 30 days
      db.execute<{ due_date: string; expected: number }>(sql`
        SELECT
          (CASE WHEN i.payment_frequency = 'daily'
            THEN i.start_date + (gs.n || ' days')::interval
            ELSE i.start_date + (gs.n || ' months')::interval
          END)::date AS due_date,
          SUM(i.monthly)::numeric AS expected
        FROM installments i
        INNER JOIN customers c ON i.customer_id = c.id
        CROSS JOIN LATERAL generate_series(1, i.months) AS gs(n)
        WHERE c.seller_id = ${sellerId}
          AND i.status = 'ACTIVE'
          AND i.deleted_at IS NULL
          AND (CASE WHEN i.payment_frequency = 'daily'
            THEN i.start_date + (gs.n || ' days')::interval
            ELSE i.start_date + (gs.n || ' months')::interval
          END) BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        GROUP BY due_date
        ORDER BY due_date
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
