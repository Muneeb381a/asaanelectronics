import { and, asc, count, eq, gte, inArray, isNull, lt, lte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, customers, expenses, installments, payments } from '../../db/schema.js';

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
