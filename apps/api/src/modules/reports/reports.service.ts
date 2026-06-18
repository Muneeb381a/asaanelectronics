import { and, asc, count, eq, gte, isNull, lt, lte, or, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, customers, expenses, installments, payments } from '../../db/schema.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type MonthlyCustomerRow = {
  srNo:          number;
  clientId:      string;
  customerName:  string;
  customerPhone: string;
  rupees:        number;     // paidAmount if Paid, monthly installment if Pending
  paidAmount:    number;
  monthlyAmount: number;
  remaining:     number;
  status:        'Paid' | 'Pending';
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
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999); // last moment of last day

    // Correlated subquery: sum of payments made in this specific month for each installment
    const paidInMonthExpr = sql<string | null>`(
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.installment_id = ${installments.id}
        AND p.deleted_at IS NULL
        AND p.paid_on >= ${monthStart}
        AND p.paid_on <= ${monthEnd}
    )`;

    // Installments to include:
    //  1. ACTIVE installments that started on or before month end (were active in this month)
    //  2. Any installment (any status) that has a payment recorded in this month
    const rows = await db
      .select({
        invoiceNumber: installments.invoiceNumber,
        customerName:  customers.name,
        customerPhone: customers.phone,
        monthly:       installments.monthly,
        remaining:     installments.remaining,
        paidInMonth:   paidInMonthExpr,
      })
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(
        eq(customers.sellerId, sellerId),
        isNull(installments.deletedAt),
        isNull(customers.deletedAt),
        or(
          // Active installments running in this month
          and(
            eq(installments.status, 'ACTIVE'),
            lte(installments.startDate, monthEnd),
          ),
          // Any installment with a payment in this month (includes completed/defaulted)
          sql`EXISTS (
            SELECT 1 FROM payments p
            WHERE p.installment_id = ${installments.id}
              AND p.deleted_at IS NULL
              AND p.paid_on >= ${monthStart}
              AND p.paid_on <= ${monthEnd}
          )`,
        ),
      ))
      .orderBy(asc(customers.name));

    // Sort: Paid first, then Pending; within each group alphabetical
    const sorted = [...rows].sort((a, b) => {
      const aPaid = Number(a.paidInMonth ?? 0) > 0;
      const bPaid = Number(b.paidInMonth ?? 0) > 0;
      if (aPaid && !bPaid) return -1;
      if (!aPaid && bPaid) return 1;
      return a.customerName.localeCompare(b.customerName);
    });

    return sorted.map((r, idx) => {
      const paid       = Number(r.paidInMonth ?? 0);
      const monthly    = Number(r.monthly);
      const isPaid     = paid > 0;
      return {
        srNo:          idx + 1,
        clientId:      r.invoiceNumber ?? '—',
        customerName:  r.customerName,
        customerPhone: r.customerPhone,
        rupees:        isPaid ? paid : monthly,
        paidAmount:    paid,
        monthlyAmount: monthly,
        remaining:     Number(r.remaining),
        status:        isPaid ? 'Paid' : 'Pending',
      };
    });
  }
}
