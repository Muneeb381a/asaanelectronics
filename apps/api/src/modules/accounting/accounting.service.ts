import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chartOfAccounts, journalEntries, ledgerLines } from '../../db/schema.js';

// Accepts either the root db or a transaction so callers can post atomically.
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Cash',                type: 'ASSET'   as const },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET'   as const },
  { code: '4000', name: 'Sales Revenue',       type: 'REVENUE' as const },
  { code: '5000', name: 'Rent Expense',        type: 'EXPENSE' as const },
  { code: '5100', name: 'Salary Expense',      type: 'EXPENSE' as const },
  { code: '5200', name: 'Utility Expense',     type: 'EXPENSE' as const },
  { code: '5300', name: 'Purchase Expense',    type: 'EXPENSE' as const },
  { code: '5400', name: 'Maintenance Expense', type: 'EXPENSE' as const },
  { code: '5500', name: 'Transport Expense',   type: 'EXPENSE' as const },
  { code: '5800', name: 'Bad Debt / Waiver',   type: 'EXPENSE' as const },
  { code: '5900', name: 'Other Expense',       type: 'EXPENSE' as const },
];

const EXPENSE_ACCOUNT: Record<string, string> = {
  RENT: '5000', SALARY: '5100', UTILITY: '5200', PURCHASE: '5300',
  MAINTENANCE: '5400', TRANSPORT: '5500', OTHER: '5900',
};

export class AccountingService {
  async initSellerAccounts(sellerId: string, ex: Executor = db) {
    await ex
      .insert(chartOfAccounts)
      .values(DEFAULT_ACCOUNTS.map((a) => ({ sellerId, ...a, isSystem: true })))
      .onConflictDoNothing();
  }

  private async getAcctIds(sellerId: string, codes: string[], ex: Executor): Promise<Record<string, string>> {
    const load = () => ex
      .select({ id: chartOfAccounts.id, code: chartOfAccounts.code })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.sellerId, sellerId), inArray(chartOfAccounts.code, codes)));

    let rows = await load();
    if (rows.length < codes.length) {
      await this.initSellerAccounts(sellerId, ex);
      rows = await load();
    }
    const map = Object.fromEntries(rows.map((r) => [r.code, r.id]));
    for (const c of codes) if (!map[c]) throw new Error(`Account ${c} not found for seller ${sellerId}`);
    return map;
  }

  private async postEntry(sellerId: string, data: {
    memo: string; refType: string; refId: string; createdBy?: string;
    lines: { accountId: string; debit: number; credit: number }[];
  }, ex: Executor) {
    const [entry] = await ex.insert(journalEntries).values({
      sellerId, memo: data.memo, refType: data.refType, refId: data.refId, createdBy: data.createdBy,
    }).returning({ id: journalEntries.id });

    await ex.insert(ledgerLines).values(
      data.lines.map((l) => ({
        journalId: entry!.id,
        accountId: l.accountId,
        debit:     String(l.debit),
        credit:    String(l.credit),
      })),
    );
  }

  /** Remove every journal entry (and its lines) posted for a source record. */
  async voidByRef(sellerId: string, refType: string, refIds: string | string[], ex: Executor = db) {
    const ids = Array.isArray(refIds) ? refIds : [refIds];
    if (ids.length === 0) return;
    const entries = await ex
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(and(eq(journalEntries.sellerId, sellerId), eq(journalEntries.refType, refType), inArray(journalEntries.refId, ids)));
    if (entries.length === 0) return;
    const jids = entries.map((e) => e.id);
    await ex.delete(ledgerLines).where(inArray(ledgerLines.journalId, jids));
    await ex.delete(journalEntries).where(inArray(journalEntries.id, jids));
  }

  async postInstallmentEntry(sellerId: string, data: {
    installmentId: string; totalAmount: number; downPayment: number; userId?: string;
  }, ex: Executor = db) {
    const acct = await this.getAcctIds(sellerId, ['1000', '1100', '4000'], ex);

    // Sale on credit: Dr Receivables / Cr Revenue
    await this.postEntry(sellerId, {
      memo: `Installment sale — PKR ${data.totalAmount.toLocaleString()}`,
      refType: 'INSTALLMENT', refId: data.installmentId, createdBy: data.userId,
      lines: [
        { accountId: acct['1100']!, debit: data.totalAmount, credit: 0 },
        { accountId: acct['4000']!, debit: 0, credit: data.totalAmount },
      ],
    }, ex);

    // Down payment received: Dr Cash / Cr Receivables
    if (data.downPayment > 0) {
      await this.postEntry(sellerId, {
        memo: `Down payment received — PKR ${data.downPayment.toLocaleString()}`,
        refType: 'INSTALLMENT', refId: data.installmentId, createdBy: data.userId,
        lines: [
          { accountId: acct['1000']!, debit: data.downPayment, credit: 0 },
          { accountId: acct['1100']!, debit: 0, credit: data.downPayment },
        ],
      }, ex);
    }
  }

  async postPaymentEntry(sellerId: string, data: {
    paymentId: string; amount: number; userId?: string;
  }, ex: Executor = db) {
    const acct = await this.getAcctIds(sellerId, ['1000', '1100'], ex);
    await this.postEntry(sellerId, {
      memo: `Payment received — PKR ${data.amount.toLocaleString()}`,
      refType: 'PAYMENT', refId: data.paymentId, createdBy: data.userId,
      lines: [
        { accountId: acct['1000']!, debit: data.amount, credit: 0 },
        { accountId: acct['1100']!, debit: 0,           credit: data.amount },
      ],
    }, ex);
  }

  /** Waiver is a non-cash write-off: Dr Bad Debt / Cr Receivables. Never touches the cash book. */
  async postWaiverEntry(sellerId: string, data: {
    installmentId: string; amount: number; reason?: string; userId?: string;
  }, ex: Executor = db) {
    const acct = await this.getAcctIds(sellerId, ['1100', '5800'], ex);
    await this.postEntry(sellerId, {
      memo: `Balance waiver${data.reason ? ': ' + data.reason : ''} — PKR ${data.amount.toLocaleString()}`,
      refType: 'WAIVER', refId: data.installmentId, createdBy: data.userId,
      lines: [
        { accountId: acct['5800']!, debit: data.amount, credit: 0 },
        { accountId: acct['1100']!, debit: 0,           credit: data.amount },
      ],
    }, ex);
  }

  async postExpenseEntry(sellerId: string, data: {
    expenseId: string; amount: number; category: string; userId?: string;
  }, ex: Executor = db) {
    const code = EXPENSE_ACCOUNT[data.category] ?? '5900';
    const acct = await this.getAcctIds(sellerId, ['1000', code], ex);
    await this.postEntry(sellerId, {
      memo: `${data.category} expense — PKR ${data.amount.toLocaleString()}`,
      refType: 'EXPENSE', refId: data.expenseId, createdBy: data.userId,
      lines: [
        { accountId: acct[code]!,   debit: data.amount, credit: 0 },
        { accountId: acct['1000']!, debit: 0,           credit: data.amount },
      ],
    }, ex);
  }

  async getBalances(sellerId: string) {
    await this.initSellerAccounts(sellerId);

    const rows = await db
      .select({
        code:    chartOfAccounts.code,
        name:    chartOfAccounts.name,
        type:    chartOfAccounts.type,
        totalDr: sql<string>`COALESCE(SUM(${ledgerLines.debit}::numeric), 0)`,
        totalCr: sql<string>`COALESCE(SUM(${ledgerLines.credit}::numeric), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(ledgerLines, eq(ledgerLines.accountId, chartOfAccounts.id))
      .where(eq(chartOfAccounts.sellerId, sellerId))
      .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name, chartOfAccounts.type)
      .orderBy(chartOfAccounts.code);

    const accounts = rows.map((r) => {
      const dr = Number(r.totalDr);
      const cr = Number(r.totalCr);
      const balance = (r.type === 'ASSET' || r.type === 'EXPENSE') ? dr - cr : cr - dr;
      return { code: r.code, name: r.name, type: r.type, debit: dr, credit: cr, balance };
    });

    const cash        = accounts.find((a) => a.code === '1000')?.balance ?? 0;
    const receivables = accounts.find((a) => a.code === '1100')?.balance ?? 0;
    const revenue     = accounts.find((a) => a.code === '4000')?.balance ?? 0;
    const expenses    = accounts.filter((a) => a.type === 'EXPENSE').reduce((s, a) => s + a.balance, 0);
    const netPL       = revenue - expenses;

    return { cash, receivables, revenue, expenses, netPL, accounts };
  }

  async listJournalEntries(sellerId: string, filters: {
    from?: string; to?: string; page?: number; limit?: number;
  } = {}) {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100);

    const conds = [eq(journalEntries.sellerId, sellerId)];
    if (filters.from) conds.push(gte(journalEntries.postedAt, new Date(filters.from)));
    if (filters.to) { const end = new Date(filters.to); end.setUTCHours(23, 59, 59, 999); conds.push(lte(journalEntries.postedAt, end)); }
    const where = and(...conds);

    const [entries, [{ count }]] = await Promise.all([
      db.select({ id: journalEntries.id, memo: journalEntries.memo, refType: journalEntries.refType, postedAt: journalEntries.postedAt })
        .from(journalEntries).where(where)
        .orderBy(desc(journalEntries.postedAt))
        .limit(limit).offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(journalEntries).where(where),
    ]);

    if (entries.length === 0) return { data: [], total: count, page, limit };

    const lines = await db
      .select({
        journalId:   ledgerLines.journalId,
        debit:       ledgerLines.debit,
        credit:      ledgerLines.credit,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
      })
      .from(ledgerLines)
      .innerJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.id))
      .where(inArray(ledgerLines.journalId, entries.map((e) => e.id)));

    const byJournal = lines.reduce<Record<string, typeof lines>>((acc, l) => {
      (acc[l.journalId] ??= []).push(l);
      return acc;
    }, {});

    return {
      data: entries.map((e) => ({ ...e, lines: byJournal[e.id] ?? [] })),
      total: count, page, limit,
    };
  }
}

export const accountingSvc = new AccountingService();
