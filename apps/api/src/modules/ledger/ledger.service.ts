import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { ledgerEntries } from '../../db/schema.js';

export class LedgerService {
  async walletBalance(sellerId: string) {
    const [row] = await db
      .select({
        credits: sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'), 0)::float`,
        debits:  sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'),  0)::float`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.sellerId, sellerId));

    const credits = Number(row?.credits ?? 0);
    const debits  = Number(row?.debits  ?? 0);
    return { credits, debits, balance: credits - debits };
  }

  async cashBook(sellerId: string, from?: string, to?: string, limit = 100) {
    const conds = [eq(ledgerEntries.sellerId, sellerId)];
    if (from) conds.push(gte(ledgerEntries.date, new Date(from)));
    if (to)   conds.push(lte(ledgerEntries.date, new Date(to)));

    return db
      .select()
      .from(ledgerEntries)
      .where(and(...conds))
      .orderBy(desc(ledgerEntries.date))
      .limit(limit);
  }

  async dailySummary(sellerId: string, date?: string) {
    const day   = date ? new Date(date) : new Date();
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end   = new Date(day); end.setHours(23, 59, 59, 999);

    const [row] = await db
      .select({
        credits:  sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'), 0)::float`,
        debits:   sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'),  0)::float`,
        txCount:  sql<number>`COUNT(*)::int`,
      })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.sellerId, sellerId), gte(ledgerEntries.date, start), lte(ledgerEntries.date, end)));

    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.sellerId, sellerId), gte(ledgerEntries.date, start), lte(ledgerEntries.date, end)))
      .orderBy(desc(ledgerEntries.date));

    const credits = Number(row?.credits ?? 0);
    const debits  = Number(row?.debits  ?? 0);
    return { date: start.toISOString().slice(0, 10), credits, debits, net: credits - debits, txCount: row?.txCount ?? 0, entries };
  }

  async profitLoss(sellerId: string, from?: string, to?: string) {
    const conds = [eq(ledgerEntries.sellerId, sellerId)];
    if (from) conds.push(gte(ledgerEntries.date, new Date(from)));
    if (to)   conds.push(lte(ledgerEntries.date, new Date(to)));

    const [totals] = await db
      .select({
        revenue:  sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'), 0)::float`,
        expenses: sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'),  0)::float`,
      })
      .from(ledgerEntries)
      .where(and(...conds));

    // Monthly breakdown
    const monthly = await db
      .select({
        month:    sql<string>`TO_CHAR(date, 'YYYY-MM')`,
        label:    sql<string>`TO_CHAR(date, 'Mon YY')`,
        revenue:  sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'), 0)::float`,
        expenses: sql<number>`COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'),  0)::float`,
      })
      .from(ledgerEntries)
      .where(and(...conds))
      .groupBy(sql`TO_CHAR(date, 'YYYY-MM')`, sql`TO_CHAR(date, 'Mon YY')`)
      .orderBy(sql`TO_CHAR(date, 'YYYY-MM')`);

    // Expense breakdown by category
    const byCategory = await db
      .select({
        category: ledgerEntries.category,
        total:    sql<number>`SUM(amount)::float`,
      })
      .from(ledgerEntries)
      .where(and(...conds, eq(ledgerEntries.type, 'DEBIT')))
      .groupBy(ledgerEntries.category)
      .orderBy(sql`SUM(amount) DESC`);

    const revenue  = Number(totals?.revenue  ?? 0);
    const expenses = Number(totals?.expenses ?? 0);
    return {
      revenue, expenses,
      profit: revenue - expenses,
      margin: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0,
      monthly: monthly.map((m) => ({ ...m, revenue: Number(m.revenue), expenses: Number(m.expenses), profit: Number(m.revenue) - Number(m.expenses) })),
      byCategory: byCategory.map((c) => ({ ...c, total: Number(c.total) })),
    };
  }
}
