import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, ledgerEntries, payments, products, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type CreateBody = {
  installmentId: string;
  amount: number;
  method: 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';
  note?: string;
  collectedBy?: string;
  proofImageUrl?: string;
};

export class PaymentsService {
  async listByInstallment(installmentId: string, sellerId: string, page = 1, limit = 50) {
    const safeLimit = Math.min(limit, 100);
    const offset = (page - 1) * safeLimit;

    const [inst] = await db
      .select({ id: installments.id })
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(eq(installments.id, installmentId), eq(customers.sellerId, sellerId)));

    if (!inst) throw new AppError('Installment not found', 404);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id:            payments.id,
          installmentId: payments.installmentId,
          amount:        payments.amount,
          paidOn:        payments.paidOn,
          method:        payments.method,
          note:          payments.note,
          deletedAt:     payments.deletedAt,
          collectedBy:   payments.collectedBy,
          proofImageUrl: payments.proofImageUrl,
          collectorName: users.name,
        })
        .from(payments)
        .leftJoin(users, eq(payments.collectedBy, users.id))
        .where(and(eq(payments.installmentId, installmentId), isNull(payments.deletedAt)))
        .orderBy(desc(payments.paidOn))
        .limit(safeLimit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(eq(payments.installmentId, installmentId), isNull(payments.deletedAt))),
    ]);

    return { data: rows, total: count, page, limit: safeLimit };
  }

  async record(sellerId: string, body: CreateBody) {
    return db.transaction(async (tx) => {
      const [inst] = await tx
        .select({ id: installments.id, remaining: installments.remaining, status: installments.status })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(installments.id, body.installmentId), eq(customers.sellerId, sellerId)));

      if (!inst) throw new AppError('Installment not found', 404);
      if (inst.status !== 'ACTIVE') throw new AppError('Installment is not active', 400);

      // Use integer arithmetic (paisas) to avoid floating-point errors
      const remainingPaisas = Math.round(Number(inst.remaining) * 100);
      const amountPaisas    = Math.round(body.amount * 100);
      if (amountPaisas > remainingPaisas) {
        throw new AppError(`Amount exceeds remaining balance of PKR ${(remainingPaisas / 100).toFixed(2)}`, 400);
      }

      const newRemaining = (remainingPaisas - amountPaisas) / 100;
      const isCleared    = newRemaining === 0;

      const [instDetail] = await tx
        .select({ productName: products.name, customerName: customers.name })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .innerJoin(products,  eq(installments.productId,  products.id))
        .where(eq(installments.id, body.installmentId));

      const [[payment]] = await Promise.all([
        tx.insert(payments).values({
          installmentId: body.installmentId,
          amount:        String(body.amount),
          method:        body.method,
          note:          body.note,
          collectedBy:   body.collectedBy ?? null,
          proofImageUrl: body.proofImageUrl ?? null,
        }).returning(),
        tx.update(installments).set({
          remaining: String(newRemaining),
          ...(isCleared && { status: 'COMPLETED' }),
        }).where(eq(installments.id, body.installmentId)),
      ]);

      await tx.insert(ledgerEntries).values({
        sellerId,
        type:        'CREDIT',
        category:    body.method,
        amount:      String(body.amount),
        description: `Payment — ${instDetail?.customerName ?? ''} · ${instDetail?.productName ?? ''}${body.note ? ` · ${body.note}` : ''}`,
        referenceId: payment.id,
        refType:     'PAYMENT',
      });

      return { payment, remaining: newRemaining, completed: isCleared };
    });
  }

  async remove(id: string, sellerId: string, deletedBy: string) {
    const [pmt] = await db
      .select({
        id:            payments.id,
        amount:        payments.amount,
        method:        payments.method,
        installmentId: payments.installmentId,
        instRemaining: installments.remaining,
        instStatus:    installments.status,
      })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .where(and(eq(payments.id, id), eq(customers.sellerId, sellerId), isNull(payments.deletedAt)));

    if (!pmt) throw new AppError('Payment not found', 404);

    const restoredRemaining = Number(pmt.instRemaining) + Number(pmt.amount);
    const statusRevert = pmt.instStatus === 'COMPLETED' && restoredRemaining > 0
      ? { status: 'ACTIVE' as const }
      : {};

    await db.transaction(async (tx) => {
      await tx.update(payments)
        .set({ deletedAt: new Date(), deletedBy })
        .where(eq(payments.id, id));

      await tx.update(installments)
        .set({ remaining: String(restoredRemaining.toFixed(2)), ...statusRevert })
        .where(eq(installments.id, pmt.installmentId));

      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'PAYMENT')),
      );
    });

    return pmt;
  }
}
