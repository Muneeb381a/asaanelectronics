import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { financialPeriods } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

export class FinancialPeriodsService {
  async list(sellerId: string) {
    return db.select().from(financialPeriods)
      .where(eq(financialPeriods.sellerId, sellerId))
      .orderBy(desc(financialPeriods.year), desc(financialPeriods.month));
  }

  async lock(sellerId: string, userId: string, year: number, month: number, notes?: string) {
    const existing = await db.query.financialPeriods.findFirst({
      where: and(
        eq(financialPeriods.sellerId, sellerId),
        eq(financialPeriods.year, year),
        eq(financialPeriods.month, month),
      ),
    });
    if (existing) return existing;

    const [row] = await db.insert(financialPeriods).values({
      sellerId,
      year,
      month,
      lockedByUserId: userId,
      notes,
    }).returning();
    return row!;
  }

  async unlock(sellerId: string, year: number, month: number) {
    const existing = await db.query.financialPeriods.findFirst({
      where: and(
        eq(financialPeriods.sellerId, sellerId),
        eq(financialPeriods.year, year),
        eq(financialPeriods.month, month),
      ),
    });
    if (!existing) throw new AppError('Period is not locked', 404);
    await db.delete(financialPeriods).where(
      and(
        eq(financialPeriods.sellerId, sellerId),
        eq(financialPeriods.year, year),
        eq(financialPeriods.month, month),
      ),
    );
    return { unlocked: true, year, month };
  }

  async isLocked(sellerId: string, date: Date): Promise<boolean> {
    const year  = date.getFullYear();
    const month = date.getMonth() + 1;
    const row = await db.query.financialPeriods.findFirst({
      where: and(
        eq(financialPeriods.sellerId, sellerId),
        eq(financialPeriods.year, year),
        eq(financialPeriods.month, month),
      ),
    });
    return !!row;
  }
}
