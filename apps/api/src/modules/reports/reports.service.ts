import { and, asc, count, eq, gte, inArray, isNull, lt, lte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, customers, expenses, installments, payments } from '../../db/schema.js';

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
  status:            'Paid' | 'Pending';
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
    };

    // 1. All ACTIVE + DEFAULTED installments that started on or before this month
    const activeRows = await db
      .select(instCols)
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(
        eq(customers.sellerId,      sellerId),
        isNull(installments.deletedAt),
        isNull(customers.deletedAt),
        inArray(installments.status, ['ACTIVE', 'DEFAULTED']),
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

    // "Paid" = customer paid the full expected monthly amount this period.
    // Completed installments (extraRows) are always Paid — they cleared their balance this month.
    // Partial payments (paid > 0 but < monthly amount) still count as Pending.
    const getIsPaid = (r: { id: string; monthly: string | null; paymentFrequency: string | null }) => {
      const paid = payMap.get(r.id) ?? 0;
      if (!activeIds.has(r.id)) return paid > 0; // completed this month — always Paid
      const monthly     = Number(r.monthly ?? 0);
      const expectedAmt = (r.paymentFrequency ?? 'monthly') === 'daily'
        ? monthly * daysInMonth
        : monthly;
      return paid >= expectedAmt;
    };

    // Merge, sort: Paid first then Pending, alphabetical within each group
    const all = [...activeRows, ...extraRows];
    all.sort((a, b) => {
      const aPaid = getIsPaid(a);
      const bPaid = getIsPaid(b);
      if (aPaid && !bPaid) return -1;
      if (!aPaid && bPaid) return  1;
      return a.customerName.localeCompare(b.customerName);
    });

    return all.map((r, idx) => {
      const paid        = payMap.get(r.id) ?? 0;
      const monthly     = Number(r.monthly);
      const expectedAmt = (r.paymentFrequency ?? 'monthly') === 'daily'
        ? monthly * daysInMonth
        : monthly;
      const isPaid      = getIsPaid(r);
      return {
        srNo:             idx + 1,
        clientId:         r.invoiceNumber ?? '—',
        customerName:     r.customerName,
        customerPhone:    r.customerPhone,
        rupees:           isPaid ? paid : expectedAmt,
        paidAmount:       paid,
        monthlyAmount:    monthly,
        remaining:        Number(r.remaining),
        status:           (isPaid ? 'Paid' : 'Pending') as 'Paid' | 'Pending',
        paymentFrequency: (r.paymentFrequency ?? 'monthly') as 'monthly' | 'daily',
      };
    });
  }
}
