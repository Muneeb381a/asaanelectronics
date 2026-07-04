import { and, asc, count, eq, gte, inArray, isNull, lt, lte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, customers, expenses, installments, payments, products, supplierInvoices } from '../../db/schema.js';

const _cache = new Map<string, { at: number; data: unknown }>();
function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const e = _cache.get(key);
  if (e && (Date.now() - e.at) < ttlMs) return Promise.resolve(e.data as T);
  return fn().then((result) => { _cache.set(key, { at: Date.now(), data: result }); return result; });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type MonthlyCustomerRow = {
  srNo:              number;
  clientId:          string;
  customerName:      string;
  customerPhone:     string;
  rupees:            number;
  paidAmount:        number;
  monthlyAmount:     number;
  remaining:         number;
  status:            'Paid' | 'Pending' | 'Defaulted';
  paymentFrequency:  'monthly' | 'daily';
};

export type MonthlyReportRow = {
  month: number;
  monthName: string;
  newInstallments: number;
  totalSaleAmount: number;
  downPayments: number;
  newCustomers: number;
  paymentsCollected: number;
  cashSalesCount: number;
  cashSalesAmount: number;
  totalExpenses: number;
  netRevenue: number;
};

export class ReportsService {
  async getMonthlyReport(sellerId: string, year: number): Promise<MonthlyReportRow[]> {
    return withCache(`monthly-report:${sellerId}:${year}`, 5 * 60_000, () => this._getMonthlyReport(sellerId, year));
  }

  private async _getMonthlyReport(sellerId: string, year: number): Promise<MonthlyReportRow[]> {
    const from = new Date(year, 0, 1);
    const to   = new Date(year + 1, 0, 1);

    const [instRows, custRows, payRows, cashRows, expRows] = await Promise.all([
      db
        .select({
          month:       sql<number>`EXTRACT(MONTH FROM ${installments.createdAt})::int`,
          cnt:         count(),
          totalAmount: sum(installments.totalAmount),
          downPayment: sum(installments.downPayment),
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          isNull(installments.deletedAt),
          isNull(customers.deletedAt),
          gte(installments.createdAt, from),
          lt(installments.createdAt, to),
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${installments.createdAt})`),

      db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${customers.createdAt})::int`,
          cnt:   count(),
        })
        .from(customers)
        .where(and(
          eq(customers.sellerId, sellerId),
          isNull(customers.deletedAt),
          gte(customers.createdAt, from),
          lt(customers.createdAt, to),
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${customers.createdAt})`),

      db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${payments.paidOn})::int`,
          total: sum(payments.amount),
        })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          isNull(payments.deletedAt),
          isNull(installments.deletedAt),
          isNull(customers.deletedAt),
          gte(payments.paidOn, from),
          lt(payments.paidOn, to),
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${payments.paidOn})`),

      db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${cashSales.createdAt})::int`,
          cnt:   count(),
          total: sum(cashSales.amount),
        })
        .from(cashSales)
        .where(and(
          eq(cashSales.sellerId, sellerId),
          gte(cashSales.createdAt, from),
          lt(cashSales.createdAt, to),
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${cashSales.createdAt})`),

      db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${expenses.date})::int`,
          total: sum(expenses.amount),
        })
        .from(expenses)
        .where(and(
          eq(expenses.sellerId, sellerId),
          gte(expenses.date, from),
          lt(expenses.date, to),
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${expenses.date})`),
    ]);

    const instMap = new Map(instRows.map((r) => [r.month, r]));
    const custMap = new Map(custRows.map((r) => [r.month, r.cnt]));
    const payMap  = new Map(payRows.map((r) => [r.month, Number(r.total ?? 0)]));
    const cashMap = new Map(cashRows.map((r) => [r.month, r]));
    const expMap  = new Map(expRows.map((r) => [r.month, Number(r.total ?? 0)]));

    return Array.from({ length: 12 }, (_, i) => {
      const m                = i + 1;
      const inst             = instMap.get(m);
      const cash             = cashMap.get(m);
      const paymentsCollected = payMap.get(m) ?? 0;
      const cashSalesAmount  = Number(cash?.total ?? 0);
      const totalExpenses    = expMap.get(m) ?? 0;
      return {
        month:             m,
        monthName:         MONTH_NAMES[i]!,
        newInstallments:   inst?.cnt ?? 0,
        totalSaleAmount:   Number(inst?.totalAmount ?? 0),
        downPayments:      Number(inst?.downPayment ?? 0),
        newCustomers:      custMap.get(m) ?? 0,
        paymentsCollected,
        cashSalesCount:    cash?.cnt ?? 0,
        cashSalesAmount,
        totalExpenses,
        netRevenue:        paymentsCollected + cashSalesAmount - totalExpenses,
      };
    });
  }

  async getMonthlyCustomers(sellerId: string, year: number, month: number): Promise<MonthlyCustomerRow[]> {
    return withCache(`monthly-customers:${sellerId}:${year}:${month}`, 5 * 60_000, () => this._getMonthlyCustomers(sellerId, year, month));
  }

  private async _getMonthlyCustomers(sellerId: string, year: number, month: number): Promise<MonthlyCustomerRow[]> {
    // UTC boundaries — consistent with paidOn storage (same approach as listBySeller)
    const monthStart  = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd    = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const instCols = {
      id:               installments.id,
      invoiceNumber:    installments.invoiceNumber,
      customerName:     customers.name,
      customerPhone:    customers.phone,
      monthly:          installments.monthly,
      remaining:        installments.remaining,
      paymentFrequency: installments.paymentFrequency,
      instStatus:       installments.status,
    };

    // 1. All PENDING + ACTIVE + DEFAULTED installments that started on or before this month.
    //    PENDING = created but not yet activated by owner (still shows as outstanding obligation).
    const activeRows = await db
      .select(instCols)
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(
        eq(customers.sellerId,      sellerId),
        isNull(installments.deletedAt),
        isNull(customers.deletedAt),
        inArray(installments.status, ['PENDING', 'ACTIVE', 'DEFAULTED']),
        lte(installments.startDate, monthEnd),
      ))
      .orderBy(asc(customers.name));

    // 2. Sum of payments per installment in this month (for this seller)
    const payRows = await db
      .select({
        installmentId: payments.installmentId,
        total:         sum(payments.amount),
      })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .where(and(
        eq(customers.sellerId,       sellerId),
        isNull(payments.deletedAt),
        isNull(installments.deletedAt),
        isNull(customers.deletedAt),
        gte(payments.paidOn, monthStart),
        lte(payments.paidOn, monthEnd),
      ))
      .groupBy(payments.installmentId);

    const payMap    = new Map(payRows.map((p) => [p.installmentId, Number(p.total ?? 0)]));
    const activeIds = new Set(activeRows.map((r) => r.id));

    // 3. Fetch installments completed this month (final payment made during this period)
    const extraIds = [...payMap.keys()].filter((id) => !activeIds.has(id));
    const extraRows = extraIds.length > 0
      ? await db
          .select(instCols)
          .from(installments)
          .innerJoin(customers, eq(installments.customerId, customers.id))
          .where(and(
            eq(customers.sellerId, sellerId),
            isNull(installments.deletedAt),
            isNull(customers.deletedAt),
            inArray(installments.id, extraIds),
          ))
      : [];

    // Determine final status for each row:
    // - DEFAULTED installments → always 'Defaulted' (even if they paid before being defaulted)
    // - extraRows (COMPLETED this month) → always 'Paid' if any payment exists
    // - ACTIVE/others → 'Paid' only if paid >= full monthly amount; partial = 'Pending'
    const getRowStatus = (r: {
      id: string;
      monthly: string | null;
      paymentFrequency: string | null;
      instStatus: string | null;
    }): 'Paid' | 'Pending' | 'Defaulted' => {
      if (r.instStatus === 'DEFAULTED') return 'Defaulted';
      if (r.instStatus === 'PENDING')   return 'Pending';
      const paid = payMap.get(r.id) ?? 0;
      if (!activeIds.has(r.id)) return paid > 0 ? 'Paid' : 'Pending'; // extraRows = completed this month
      const monthly     = Number(r.monthly ?? 0);
      const expectedAmt = (r.paymentFrequency ?? 'monthly') === 'daily'
        ? monthly * daysInMonth
        : monthly;
      return paid >= expectedAmt ? 'Paid' : 'Pending';
    };

    // Sort: Paid first, then Pending, then Defaulted — alphabetical within each group
    const statusOrder = { Paid: 0, Pending: 1, Defaulted: 2 } as const;
    const all = [...activeRows, ...extraRows];
    all.sort((a, b) => {
      const diff = statusOrder[getRowStatus(a)] - statusOrder[getRowStatus(b)];
      if (diff !== 0) return diff;
      return a.customerName.localeCompare(b.customerName);
    });

    return all.map((r, idx) => {
      const paid        = payMap.get(r.id) ?? 0;
      const monthly     = Number(r.monthly);
      const expectedAmt = (r.paymentFrequency ?? 'monthly') === 'daily'
        ? monthly * daysInMonth
        : monthly;
      const status      = getRowStatus(r);
      return {
        srNo:             idx + 1,
        clientId:         r.invoiceNumber ?? '—',
        customerName:     r.customerName,
        customerPhone:    r.customerPhone,
        rupees:           status === 'Paid' ? paid : expectedAmt,
        paidAmount:       paid,
        monthlyAmount:    monthly,
        remaining:        Number(r.remaining),
        status,
        paymentFrequency: (r.paymentFrequency ?? 'monthly') as 'monthly' | 'daily',
      };
    });
  }

  async getAgingReport(sellerId: string) {
    type AgingRow = {
      bucket: string;
      count: number;
      totalOutstanding: string;
    };

    const rows = await db.execute<AgingRow>(sql`
      WITH installment_dpd AS (
        SELECT
          i.id,
          i.remaining::numeric AS outstanding,
          GREATEST(0,
            CASE
              WHEN i.payment_frequency = 'daily' THEN
                GREATEST(0,
                  EXTRACT(DAY FROM (NOW() - i.start_date))::int
                  - FLOOR(COALESCE(paid.total, 0) / NULLIF(i.monthly::numeric, 0))::int
                )
              ELSE
                GREATEST(0,
                  (EXTRACT(YEAR FROM AGE(NOW(), i.start_date)) * 12
                   + EXTRACT(MONTH FROM AGE(NOW(), i.start_date)))::int
                  - FLOOR(COALESCE(paid.total, 0) / NULLIF(i.monthly::numeric, 0))::int
                ) * 30
            END
          ) AS dpd
        FROM installments i
        JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
        LEFT JOIN (
          SELECT installment_id, SUM(amount::numeric) AS total
          FROM payments
          WHERE deleted_at IS NULL
          GROUP BY installment_id
        ) paid ON paid.installment_id = i.id
        WHERE c.seller_id = ${sellerId}
          AND i.status = 'ACTIVE'
          AND i.deleted_at IS NULL
      )
      SELECT
        bucket,
        COUNT(*)::int   AS count,
        COALESCE(SUM(outstanding), 0)::text AS "totalOutstanding"
      FROM (
        SELECT
          outstanding,
          CASE
            WHEN dpd = 0             THEN 'current'
            WHEN dpd BETWEEN 1 AND 7 THEN '1-7'
            WHEN dpd BETWEEN 8 AND 30 THEN '8-30'
            WHEN dpd BETWEEN 31 AND 90 THEN '31-90'
            ELSE '90+'
          END AS bucket
        FROM installment_dpd
      ) bucketed
      GROUP BY bucket
      ORDER BY
        CASE bucket
          WHEN 'current' THEN 0
          WHEN '1-7'     THEN 1
          WHEN '8-30'    THEN 2
          WHEN '31-90'   THEN 3
          ELSE 4
        END
    `);
    return rows;
  }

  async getCollectionsHeatmap(sellerId: string, year: number, month: number) {
    const rows = await db.execute<{ day: number; total: string; count: number }>(sql`
      SELECT
        EXTRACT(DAY FROM p.paid_on)::int AS day,
        COALESCE(SUM(p.amount::numeric), 0)::text AS total,
        COUNT(*)::int AS count
      FROM payments p
      JOIN installments i ON i.id = p.installment_id AND i.deleted_at IS NULL
      JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
      WHERE c.seller_id = ${sellerId}
        AND p.deleted_at IS NULL
        AND EXTRACT(YEAR FROM p.paid_on) = ${year}
        AND EXTRACT(MONTH FROM p.paid_on) = ${month}
      GROUP BY EXTRACT(DAY FROM p.paid_on)
      ORDER BY day
    `);

    const daysInMonth = new Date(year, month, 0).getDate();
    const map = new Map(rows.map((r) => [r.day, { total: Number(r.total), count: r.count }]));

    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = map.get(i + 1);
      return { day: i + 1, total: d?.total ?? 0, count: d?.count ?? 0 };
    });
  }

  async getPnL(sellerId: string, year: number, month?: number) {
    const from = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const to   = month ? new Date(year, month,     1) : new Date(year + 1, 0, 1);

    const [payRow, cashRow, expRow, instCogs, cashCogs, suppRow] = await Promise.all([
      // Revenue: installment payments collected
      db.select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          isNull(payments.deletedAt),
          isNull(installments.deletedAt),
          isNull(customers.deletedAt),
          gte(payments.paidOn, from),
          lt(payments.paidOn, to),
        )),

      // Revenue: cash sales
      db.select({ total: sum(cashSales.amount) })
        .from(cashSales)
        .where(and(eq(cashSales.sellerId, sellerId), gte(cashSales.createdAt, from), lt(cashSales.createdAt, to))),

      // Expenses
      db.select({ total: sum(expenses.amount) })
        .from(expenses)
        .where(and(eq(expenses.sellerId, sellerId), gte(expenses.date, from), lt(expenses.date, to))),

      // COGS: purchase price of products sold via installments
      db.execute<{ cogs: string }>(sql`
        SELECT COALESCE(SUM(p.purchase_price::numeric), 0)::text AS cogs
        FROM installments i
        JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
        JOIN products p  ON p.id = i.product_id
        WHERE c.seller_id = ${sellerId}
          AND i.deleted_at IS NULL
          AND i.created_at >= ${from.toISOString()}
          AND i.created_at <  ${to.toISOString()}
          AND p.purchase_price IS NOT NULL
      `),

      // COGS: purchase price of products sold via cash sales
      db.execute<{ cogs: string }>(sql`
        SELECT COALESCE(SUM(p.purchase_price::numeric * cs.quantity), 0)::text AS cogs
        FROM cash_sales cs
        JOIN products p ON p.id = cs.product_id
        WHERE cs.seller_id = ${sellerId}
          AND cs.created_at >= ${from.toISOString()}
          AND cs.created_at <  ${to.toISOString()}
          AND p.purchase_price IS NOT NULL
      `),

      // Supplier invoices issued in period (alternative COGS view)
      db.select({ total: sum(supplierInvoices.totalAmount), paid: sum(supplierInvoices.paidAmount) })
        .from(supplierInvoices)
        .where(and(
          eq(supplierInvoices.sellerId, sellerId),
          gte(supplierInvoices.invoiceDate, from.toISOString().slice(0, 10)),
          lt(supplierInvoices.invoiceDate,  to.toISOString().slice(0, 10)),
        )),
    ]);

    const installmentRevenue = Number(payRow[0]?.total ?? 0);
    const cashRevenue        = Number(cashRow[0]?.total ?? 0);
    const totalRevenue       = installmentRevenue + cashRevenue;
    const totalExpenses      = Number(expRow[0]?.total ?? 0);
    const cogsSales          = Number(instCogs[0]?.cogs ?? 0) + Number(cashCogs[0]?.cogs ?? 0);
    const supplierPurchases  = Number(suppRow[0]?.total ?? 0);
    const supplierPaid       = Number(suppRow[0]?.paid  ?? 0);
    const grossProfit        = totalRevenue - cogsSales;
    const netProfit          = grossProfit - totalExpenses;

    return {
      period: month
        ? `${year}-${String(month).padStart(2, '0')}`
        : String(year),
      installmentRevenue,
      cashRevenue,
      totalRevenue,
      cogsSales,
      grossProfit,
      grossMarginPct: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0,
      totalExpenses,
      netProfit,
      netMarginPct: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
      supplierPurchases,
      supplierPaid,
      supplierOutstanding: supplierPurchases - supplierPaid,
    };
  }

  async getAreaReport(sellerId: string) {
    const rows = await db.execute<{
      area: string;
      customers: number;
      active: number;
      overdue: number;
      overdueAmount: string;
      totalCollected: string;
      remaining: string;
    }>(sql`
      SELECT
        COALESCE(NULLIF(c.area, ''), 'No Area') AS area,
        COUNT(DISTINCT c.id)::int                AS customers,
        COUNT(DISTINCT CASE WHEN i.status = 'ACTIVE'    THEN i.id END)::int AS active,
        COUNT(DISTINCT CASE WHEN i.status = 'ACTIVE' AND (
          CASE WHEN i.payment_frequency = 'daily'
            THEN i.start_date + (i.months || ' days')::interval
            ELSE i.start_date + (i.months || ' months')::interval
          END) < NOW() THEN i.id END)::int       AS overdue,
        COALESCE(SUM(CASE WHEN i.status = 'ACTIVE' AND (
          CASE WHEN i.payment_frequency = 'daily'
            THEN i.start_date + (i.months || ' days')::interval
            ELSE i.start_date + (i.months || ' months')::interval
          END) < NOW() THEN i.remaining::numeric ELSE 0 END), 0)::text AS "overdueAmount",
        COALESCE(SUM(p.amount::numeric), 0)::text AS "totalCollected",
        COALESCE(SUM(CASE WHEN i.status = 'ACTIVE' THEN i.remaining::numeric ELSE 0 END), 0)::text AS remaining
      FROM customers c
      LEFT JOIN installments i ON i.customer_id = c.id AND i.deleted_at IS NULL
      LEFT JOIN payments p     ON p.installment_id = i.id AND p.deleted_at IS NULL
      WHERE c.seller_id = ${sellerId} AND c.deleted_at IS NULL
      GROUP BY COALESCE(NULLIF(c.area, ''), 'No Area')
      ORDER BY "totalCollected"::numeric DESC
    `);
    return rows;
  }

  async getForecast(sellerId: string) {
    const now = new Date();

    const rows = await db.execute<{
      monthly:           string;
      remaining:         string;
      payment_frequency: string | null;
    }>(sql`
      SELECT monthly, remaining, payment_frequency
      FROM installments
      WHERE seller_id = ${sellerId}
        AND status    = 'ACTIVE'
        AND deleted_at IS NULL
        AND remaining::numeric > 0
        AND monthly::numeric   > 0
    `);

    type Bucket = {
      month:            string;
      monthName:        string;
      year:             number;
      monthIndex:       number;
      expectedAmount:   number;
      monthlyAmount:    number;
      dailyAmount:      number;
      installmentCount: number;
    };

    const buckets: Bucket[] = [1, 2, 3].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return {
        month:            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        monthName:        d.toLocaleString('en-PK', { month: 'long', year: 'numeric' }),
        year:             d.getFullYear(),
        monthIndex:       d.getMonth(),
        expectedAmount:   0,
        monthlyAmount:    0,
        dailyAmount:      0,
        installmentCount: 0,
      };
    });

    for (const row of rows) {
      const M = Number(row.monthly);
      const R = Number(row.remaining);
      if (M <= 0 || R <= 0) continue;

      const isDaily = row.payment_frequency === 'daily';

      if (isDaily) {
        const daysRemaining = Math.ceil(R / M);
        for (let bi = 0; bi < 3; bi++) {
          const { year, monthIndex } = buckets[bi];
          const monthStart = new Date(year, monthIndex, 1);
          const monthEnd   = new Date(year, monthIndex + 1, 0);
          const daysToStart = Math.max(0, Math.ceil((monthStart.getTime() - now.getTime()) / 86400000));
          const daysToEnd   = Math.ceil((monthEnd.getTime() - now.getTime()) / 86400000);
          const usableDays  = Math.max(0, Math.min(daysToEnd, daysRemaining) - daysToStart);
          const contribution = usableDays * M;
          if (contribution > 0) {
            buckets[bi].expectedAmount   += contribution;
            buckets[bi].dailyAmount      += contribution;
            buckets[bi].installmentCount += 1;
          }
        }
      } else {
        for (let j = 1; j <= 3; j++) {
          const balanceBefore = R - M * (j - 1);
          if (balanceBefore <= 0) break;
          const contribution = Math.min(M, balanceBefore);
          buckets[j - 1].expectedAmount   += contribution;
          buckets[j - 1].monthlyAmount    += contribution;
          buckets[j - 1].installmentCount += 1;
        }
      }
    }

    return buckets.map(({ month, monthName, expectedAmount, monthlyAmount, dailyAmount, installmentCount }) => ({
      month,
      monthName,
      expectedAmount:   Math.round(expectedAmount),
      monthlyAmount:    Math.round(monthlyAmount),
      dailyAmount:      Math.round(dailyAmount),
      installmentCount,
    }));
  }

  async getCashflowCalendar(sellerId: string, year: number, month: number) {
    const rows = await db.execute<{
      date:             string;
      expected_amount:  number;
      expected_count:   number;
      collected_amount: number;
      collected_count:  number;
    }>(sql`
      WITH days AS (
        SELECT generate_series(
          make_date(${year}::int, ${month}::int, 1),
          make_date(${year}::int, ${month}::int, 1) + INTERVAL '1 month' - INTERVAL '1 day',
          INTERVAL '1 day'
        )::date AS day
      ),
      monthly_exp AS (
        SELECT d.day,
          COALESCE(SUM(i.monthly::float), 0) AS expected,
          COUNT(i.id)                          AS cnt
        FROM days d
        LEFT JOIN installments i ON
          i.payment_due_day = EXTRACT(DAY FROM d.day)::int
          AND i.payment_frequency = 'monthly'
          AND i.status IN ('ACTIVE', 'DEFAULTED')
          AND i.deleted_at IS NULL
          AND i.start_date::date <= d.day
          AND i.customer_id IN (
            SELECT id FROM customers WHERE seller_id = ${sellerId} AND deleted_at IS NULL
          )
        GROUP BY d.day
      ),
      daily_exp AS (
        SELECT d.day,
          COALESCE(SUM(i.monthly::float), 0) AS expected,
          COUNT(i.id)                          AS cnt
        FROM days d
        LEFT JOIN installments i ON
          i.payment_frequency = 'daily'
          AND i.status IN ('ACTIVE', 'DEFAULTED')
          AND i.deleted_at IS NULL
          AND i.start_date::date <= d.day
          AND i.customer_id IN (
            SELECT id FROM customers WHERE seller_id = ${sellerId} AND deleted_at IS NULL
          )
        GROUP BY d.day
      ),
      collected AS (
        SELECT
          p.paid_on::date AS day,
          COALESCE(SUM(p.amount::float), 0) AS amt,
          COUNT(*)::int                      AS cnt
        FROM payments p
        JOIN installments i ON i.id = p.installment_id AND i.deleted_at IS NULL
        JOIN customers c ON c.id = i.customer_id AND c.seller_id = ${sellerId} AND c.deleted_at IS NULL
        WHERE p.paid_on >= make_date(${year}::int, ${month}::int, 1)
          AND p.paid_on <  make_date(${year}::int, ${month}::int, 1) + INTERVAL '1 month'
          AND p.deleted_at IS NULL
        GROUP BY p.paid_on::date
      )
      SELECT
        d.day::text                                            AS date,
        (COALESCE(me.expected, 0) + COALESCE(de.expected, 0)) AS expected_amount,
        (COALESCE(me.cnt, 0) + COALESCE(de.cnt, 0))::int      AS expected_count,
        COALESCE(c.amt, 0)                                     AS collected_amount,
        COALESCE(c.cnt, 0)::int                                AS collected_count
      FROM days d
      LEFT JOIN monthly_exp me ON me.day = d.day
      LEFT JOIN daily_exp   de ON de.day = d.day
      LEFT JOIN collected    c  ON c.day  = d.day
      ORDER BY d.day
    `);

    return rows.map((r) => ({
      date:            String(r.date).slice(0, 10),
      expectedAmount:  Number(r.expected_amount),
      expectedCount:   Number(r.expected_count),
      collectedAmount: Number(r.collected_amount),
      collectedCount:  Number(r.collected_count),
    }));
  }

  async getCashflowDay(sellerId: string, date: string) {
    const rows = await db.execute<{
      id:               string;
      customer_name:    string;
      customer_phone:   string;
      area:             string | null;
      address:          string | null;
      product_name:     string;
      monthly:          string;
      remaining:        string;
      status:           string;
      payment_frequency: string;
      paid_today:       number;
      payment_count:    number;
    }>(sql`
      SELECT
        i.id,
        c.name      AS customer_name,
        c.phone     AS customer_phone,
        c.area,
        c.address,
        pr.name     AS product_name,
        i.monthly::text,
        i.remaining::text,
        i.status,
        i.payment_frequency,
        COALESCE(dp.total_paid, 0)::float   AS paid_today,
        COALESCE(dp.payment_count, 0)::int  AS payment_count
      FROM installments i
      JOIN customers c  ON c.id  = i.customer_id AND c.seller_id = ${sellerId} AND c.deleted_at IS NULL
      JOIN products  pr ON pr.id = i.product_id
      LEFT JOIN (
        SELECT installment_id,
          SUM(amount::float) AS total_paid,
          COUNT(*)           AS payment_count
        FROM payments
        WHERE paid_on::date = ${date}::date AND deleted_at IS NULL
        GROUP BY installment_id
      ) dp ON dp.installment_id = i.id
      WHERE i.deleted_at IS NULL
        AND i.status IN ('ACTIVE', 'DEFAULTED')
        AND i.start_date::date <= ${date}::date
        AND (
          (i.payment_frequency = 'monthly'
            AND i.payment_due_day = EXTRACT(DAY FROM ${date}::date)::int)
          OR i.payment_frequency = 'daily'
        )
      ORDER BY
        CASE WHEN COALESCE(dp.total_paid, 0) = 0 THEN 0 ELSE 1 END,
        CASE i.status WHEN 'DEFAULTED' THEN 0 ELSE 1 END,
        c.area NULLS LAST,
        c.name
    `);

    return rows.map((r) => ({
      id:               r.id,
      customerName:     r.customer_name,
      customerPhone:    r.customer_phone,
      area:             r.area,
      address:          r.address,
      productName:      r.product_name,
      monthly:          Number(r.monthly),
      remaining:        Number(r.remaining),
      status:           r.status,
      paymentFrequency: r.payment_frequency,
      paidToday:        Number(r.paid_today),
      paymentCount:     Number(r.payment_count),
    }));
  }

  async getCustomerBalances(sellerId: string) {
    const rows = await db.execute<{
      customer_id: string; customer_name: string; customer_phone: string;
      customer_address: string | null;
      installment_id: string; product_name: string; total_amount: string;
      down_payment: string; remaining: string; monthly: string; months: number;
      payment_frequency: string; start_date: string; payment_due_day: number;
      status: string;
      last_payment_date: string | null; last_payment_amount: string | null;
      paid_total: string;
    }>(sql`
      SELECT
        c.id              AS customer_id,
        c.name            AS customer_name,
        c.phone           AS customer_phone,
        c.address         AS customer_address,
        i.id              AS installment_id,
        p.name            AS product_name,
        i.total_amount,
        i.down_payment,
        i.remaining,
        i.monthly,
        i.months,
        i.payment_frequency,
        i.start_date,
        i.payment_due_day,
        i.status,
        lp.paid_on        AS last_payment_date,
        lp.amount         AS last_payment_amount,
        COALESCE(pt.paid_total, '0') AS paid_total
      FROM installments i
      INNER JOIN customers c ON i.customer_id = c.id
      INNER JOIN products  p ON i.product_id  = p.id
      LEFT JOIN LATERAL (
        SELECT amount, paid_on FROM payments
        WHERE installment_id = i.id AND deleted_at IS NULL
        ORDER BY paid_on DESC, created_at DESC LIMIT 1
      ) lp ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0)::text AS paid_total FROM payments
        WHERE installment_id = i.id AND deleted_at IS NULL
      ) pt ON true
      WHERE c.seller_id = ${sellerId}
        AND i.status IN ('ACTIVE', 'DEFAULTED')
        AND i.deleted_at IS NULL
        AND c.deleted_at IS NULL
      ORDER BY c.name ASC, i.start_date ASC
    `);

    // Compute next due date for each installment
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    type InstRow = {
      installmentId: string; productName: string; totalAmount: number;
      downPayment: number; remaining: number; monthly: number; months: number;
      paidTotal: number; lastPaymentDate: string | null; lastPaymentAmount: number | null;
      nextDueDate: string | null; daysUntilDue: number | null; status: string;
    };

    const customerMap = new Map<string, {
      customerId: string; customerName: string; customerPhone: string;
      customerAddress: string | null; installments: InstRow[];
    }>();

    for (const r of rows) {
      const monthly    = Number(r.monthly);
      const totalAmt   = Number(r.total_amount);
      const downPmt    = Number(r.down_payment);
      const remaining  = Number(r.remaining);
      const paidTotal  = Number(r.paid_total);

      // Compute next due date
      let nextDueDate: string | null = null;
      let daysUntilDue: number | null = null;

      if (r.status === 'ACTIVE' && monthly > 0) {
        const paidPeriods = Math.max(0, Math.floor((totalAmt - downPmt - remaining) / monthly + 0.001));
        const nextPeriod  = paidPeriods + 1;

        if (nextPeriod <= r.months) {
          const startDate = new Date(r.start_date);
          let due: Date;

          if (r.payment_frequency === 'daily') {
            due = new Date(startDate);
            due.setDate(due.getDate() + nextPeriod);
          } else {
            const dueDay = Number(r.payment_due_day) || 10;
            const mo = startDate.getMonth() + nextPeriod;
            const lastDay = new Date(startDate.getFullYear(), mo + 1, 0).getDate();
            due = new Date(startDate.getFullYear(), mo, Math.min(dueDay, lastDay));
          }

          const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
          daysUntilDue = Math.floor((dueMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);
          nextDueDate  = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
        }
      }

      if (!customerMap.has(r.customer_id)) {
        customerMap.set(r.customer_id, {
          customerId:      r.customer_id,
          customerName:    r.customer_name,
          customerPhone:   r.customer_phone,
          customerAddress: r.customer_address ?? null,
          installments:    [],
        });
      }

      customerMap.get(r.customer_id)!.installments.push({
        installmentId:       r.installment_id,
        productName:         r.product_name,
        totalAmount:         totalAmt,
        downPayment:         downPmt,
        remaining,
        monthly,
        months:              r.months,
        paidTotal,
        lastPaymentDate:     r.last_payment_date ?? null,
        lastPaymentAmount:   r.last_payment_amount != null ? Number(r.last_payment_amount) : null,
        nextDueDate,
        daysUntilDue,
        status:              r.status,
      });
    }

    const result = Array.from(customerMap.values()).map((c) => {
      const totalRemaining  = c.installments.reduce((s, i) => s + i.remaining, 0);
      const totalPaid       = c.installments.reduce((s, i) => s + i.paidTotal, 0);
      const activeCount     = c.installments.filter((i) => i.status === 'ACTIVE').length;
      const defaultedCount  = c.installments.filter((i) => i.status === 'DEFAULTED').length;
      const mostOverdue     = c.installments
        .filter((i) => i.daysUntilDue !== null && i.daysUntilDue < 0)
        .reduce((worst, i) => (i.daysUntilDue! < (worst?.daysUntilDue ?? 0) ? i : worst), null as InstRow | null);

      return {
        ...c,
        totalRemaining,
        totalPaid,
        activeCount,
        defaultedCount,
        mostOverdueDays: mostOverdue ? Math.abs(mostOverdue.daysUntilDue!) : 0,
      };
    });

    // Sort: defaulted first, then by most overdue, then by remaining balance desc
    result.sort((a, b) => {
      if (a.defaultedCount > 0 && b.defaultedCount === 0) return -1;
      if (b.defaultedCount > 0 && a.defaultedCount === 0) return 1;
      if (b.mostOverdueDays !== a.mostOverdueDays) return b.mostOverdueDays - a.mostOverdueDays;
      return b.totalRemaining - a.totalRemaining;
    });

    const grandTotal = result.reduce((s, c) => s + c.totalRemaining, 0);
    return { customers: result, grandTotal };
  }
}
