import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { expenses, ledgerEntries } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { FinancialPeriodsService } from './financial-periods.service.js';

const periodsSvc = new FinancialPeriodsService();

type Category = 'RENT' | 'SALARY' | 'UTILITY' | 'PURCHASE' | 'MAINTENANCE' | 'TRANSPORT' | 'OTHER';

type CreateBody  = { category: Category; amount: number; description?: string; date?: string; isRecurring?: boolean; recurrenceDay?: number };
type UpdateBody  = { category?: Category; amount?: number; description?: string; date?: string; isRecurring?: boolean; recurrenceDay?: number };

export class ExpensesService {
  async list(sellerId: string, from?: string, to?: string) {
    const conds = [eq(expenses.sellerId, sellerId)];
    if (from) conds.push(gte(expenses.date, new Date(from)));
    if (to)   conds.push(lte(expenses.date, new Date(to)));
    return db.select().from(expenses).where(and(...conds)).orderBy(desc(expenses.date));
  }

  async getRecurringSuggestions(sellerId: string) {
    const now  = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    type SugRow = {
      id: string; category: string; amount: string;
      description: string | null; recurrenceDay: number; lastDate: string;
    };

    // Find recurring expense templates and check if already logged this month
    return db.execute<SugRow>(sql`
      SELECT
        r.id, r.category, r.amount, r.description, r.recurrence_day AS "recurrenceDay",
        r.date AS "lastDate"
      FROM expenses r
      WHERE r.seller_id = ${sellerId}
        AND r.is_recurring = true
        AND r.date < ${monthStart}
        AND NOT EXISTS (
          SELECT 1 FROM expenses e2
          WHERE e2.seller_id = ${sellerId}
            AND e2.category  = r.category
            AND (e2.description IS NOT DISTINCT FROM r.description)
            AND e2.date >= ${monthStart}
            AND e2.date <  ${monthEnd}
        )
      ORDER BY r.recurrence_day ASC, r.date DESC
    `);
  }

  async create(sellerId: string, body: CreateBody) {
    const date = body.date ? new Date(body.date) : new Date();

    if (await periodsSvc.isLocked(sellerId, date)) {
      const y = date.getFullYear(), m = date.getMonth() + 1;
      throw new AppError(`${m}/${y} period lock hai — owner se unlock karwain.`, 403);
    }

    return db.transaction(async (tx) => {
      const [expense] = await tx.insert(expenses).values({
        sellerId,
        category: body.category,
        amount: String(body.amount),
        description: body.description,
        date,
        isRecurring:   body.isRecurring   ?? false,
        recurrenceDay: body.recurrenceDay ?? 1,
      }).returning();

      await tx.insert(ledgerEntries).values({
        sellerId,
        type: 'DEBIT',
        category: body.category,
        amount: String(body.amount),
        description: body.description ?? body.category,
        date,
        referenceId: expense.id,
        refType: 'EXPENSE',
      });

      return expense;
    });
  }

  async update(id: string, sellerId: string, body: UpdateBody) {
    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, id), eq(expenses.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Expense not found', 404);

    if (await periodsSvc.isLocked(sellerId, new Date(existing.date as unknown as string))) {
      throw new AppError('Purana period lock hai — owner se unlock karwain.', 403);
    }
    if (body.date) {
      const newDate = new Date(body.date);
      if (await periodsSvc.isLocked(sellerId, newDate)) {
        const y = newDate.getFullYear(), m = newDate.getMonth() + 1;
        throw new AppError(`${m}/${y} period lock hai — owner se unlock karwain.`, 403);
      }
    }

    const date        = body.date ? new Date(body.date) : undefined;
    const amount      = body.amount != null ? String(body.amount) : undefined;
    const category    = body.category ?? existing.category;
    const description = body.description ?? existing.description ?? undefined;

    return db.transaction(async (tx) => {
      const [updated] = await tx.update(expenses).set({
        ...(body.category    && { category: body.category }),
        ...(amount           && { amount }),
        ...(body.description !== undefined && { description: body.description }),
        ...(date             && { date }),
        ...(body.isRecurring   !== undefined && { isRecurring: body.isRecurring }),
        ...(body.recurrenceDay !== undefined && { recurrenceDay: body.recurrenceDay }),
      }).where(and(eq(expenses.id, id), eq(expenses.sellerId, sellerId))).returning();

      await tx.update(ledgerEntries).set({
        category:    category,
        amount:      amount ?? existing.amount,
        description: description ?? category,
        ...(date && { date }),
      }).where(and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'EXPENSE')));

      return updated;
    });
  }

  async remove(id: string, sellerId: string) {
    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, id), eq(expenses.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Expense not found', 404);

    if (await periodsSvc.isLocked(sellerId, new Date(existing.date as unknown as string))) {
      throw new AppError('Locked period ki expense delete nahi ho sakti — owner se unlock karwain.', 403);
    }

    await db.transaction(async (tx) => {
      await tx.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.sellerId, sellerId)));
      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'EXPENSE')),
      );
    });
    return existing;
  }
}
