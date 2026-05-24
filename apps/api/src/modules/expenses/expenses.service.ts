import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { expenses, ledgerEntries } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type Category = 'RENT' | 'SALARY' | 'UTILITY' | 'PURCHASE' | 'MAINTENANCE' | 'TRANSPORT' | 'OTHER';

type CreateBody = { category: Category; amount: number; description?: string; date?: string };

export class ExpensesService {
  async list(sellerId: string, from?: string, to?: string) {
    const conds = [eq(expenses.sellerId, sellerId)];
    if (from) conds.push(gte(expenses.date, new Date(from)));
    if (to)   conds.push(lte(expenses.date, new Date(to)));
    return db.select().from(expenses).where(and(...conds)).orderBy(desc(expenses.date));
  }

  async create(sellerId: string, body: CreateBody) {
    const date = body.date ? new Date(body.date) : new Date();

    return db.transaction(async (tx) => {
      const [expense] = await tx.insert(expenses).values({
        sellerId,
        category: body.category,
        amount: String(body.amount),
        description: body.description,
        date,
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

  async remove(id: string, sellerId: string) {
    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, id), eq(expenses.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Expense not found', 404);

    await db.transaction(async (tx) => {
      await tx.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.sellerId, sellerId)));
      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'EXPENSE')),
      );
    });
    return existing;
  }
}
