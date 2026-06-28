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
}
