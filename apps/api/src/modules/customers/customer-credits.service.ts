import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customerCredits, customers, installments, products, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { clearSellerStatsCache } from '../stats/stats.service.js';

export class CustomerCreditsService {
  async getBalance(customerId: string, sellerId: string): Promise<number> {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
      columns: { id: true },
    });
    if (!customer) throw new AppError('Customer not found', 404);

    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(${customerCredits.amount}), 0)` })
      .from(customerCredits)
      .where(and(eq(customerCredits.customerId, customerId), eq(customerCredits.sellerId, sellerId)));
    return Number(row?.total ?? 0);
  }

  async listHistory(customerId: string, sellerId: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
      columns: { id: true },
    });
    if (!customer) throw new AppError('Customer not found', 404);

    return db
      .select({
        id:          customerCredits.id,
        amount:      customerCredits.amount,
        type:        customerCredits.type,
        note:        customerCredits.note,
        createdAt:   customerCredits.createdAt,
        productName: products.name,
        createdByName: users.name,
      })
      .from(customerCredits)
      .leftJoin(installments, eq(customerCredits.appliedToInstallmentId, installments.id))
      .leftJoin(products, eq(installments.productId, products.id))
      .leftJoin(users, eq(customerCredits.createdById, users.id))
      .where(and(eq(customerCredits.customerId, customerId), eq(customerCredits.sellerId, sellerId)))
      .orderBy(desc(customerCredits.createdAt));
  }

  // Draws down store credit against a specific active installment — a pure
  // ledger reallocation, not a cash transaction, so it deliberately does NOT
  // insert a `payments` row (that would double-count in today's/this month's
  // collections stats, since the real cash was already counted at the
  // original overpayment).
  async apply(customerId: string, sellerId: string, userId: string, body: { installmentId: string; amount: number }) {
    if (!body.amount || body.amount <= 0) throw new AppError('Amount must be greater than 0', 400);

    return db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)));
      if (!customer) throw new AppError('Customer not found', 404);

      const [inst] = await tx
        .select({ id: installments.id, remaining: installments.remaining, status: installments.status, customerId: installments.customerId })
        .from(installments)
        .where(eq(installments.id, body.installmentId));
      if (!inst || inst.customerId !== customerId) throw new AppError('Installment not found for this customer', 404);
      if (inst.status !== 'ACTIVE') throw new AppError('Installment is not active', 400);

      const remainingPaisas = Math.round(Number(inst.remaining) * 100);
      const amountPaisas    = Math.round(body.amount * 100);
      if (amountPaisas > remainingPaisas) throw new AppError(`Amount exceeds remaining balance of PKR ${(remainingPaisas / 100).toFixed(2)}`, 400);

      const [balRow] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${customerCredits.amount}), 0)` })
        .from(customerCredits)
        .where(and(eq(customerCredits.customerId, customerId), eq(customerCredits.sellerId, sellerId)));
      const balancePaisas = Math.round(Number(balRow?.total ?? 0) * 100);
      if (amountPaisas > balancePaisas) throw new AppError(`Insufficient credit — available PKR ${(balancePaisas / 100).toFixed(2)}`, 400);

      const newRemaining = (remainingPaisas - amountPaisas) / 100;
      const isCleared    = newRemaining === 0;

      await tx.update(installments).set({
        remaining: String(newRemaining),
        ...(isCleared && { status: 'COMPLETED', completedAt: new Date() }),
      }).where(eq(installments.id, body.installmentId));

      await tx.insert(customerCredits).values({
        sellerId,
        customerId,
        amount:                 String(-body.amount),
        type:                   'APPLIED',
        appliedToInstallmentId: body.installmentId,
        createdById:            userId,
      });

      return { remaining: newRemaining, completed: isCleared };
    }).then((r) => {
      clearSellerStatsCache(sellerId);
      return r;
    });
  }
}
