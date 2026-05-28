import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, ledgerEntries, payments, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type CreateBody = {
  installmentId: string;
  amount: number;
  method: 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';
  note?: string;
};

export class PaymentsService {
  async listByInstallment(installmentId: string, sellerId: string) {
    // Verify ownership first
    const [inst] = await db
      .select({ id: installments.id })
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(eq(installments.id, installmentId), eq(customers.sellerId, sellerId)));

    if (!inst) throw new AppError('Installment not found', 404);

    return db
      .select()
      .from(payments)
      .where(and(eq(payments.installmentId, installmentId), isNull(payments.deletedAt)))
      .orderBy(desc(payments.paidOn));
  }

  async record(sellerId: string, body: CreateBody) {
    return db.transaction(async (tx) => {
      // Lock + verify installment belongs to this seller
      const [inst] = await tx
        .select({
          id: installments.id,
          remaining: installments.remaining,
          status: installments.status,
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(installments.id, body.installmentId), eq(customers.sellerId, sellerId)));

      if (!inst) throw new AppError('Installment not found', 404);
      if (inst.status !== 'ACTIVE') throw new AppError('Installment is not active', 400);

      const currentRemaining = Number(inst.remaining);
      if (body.amount > currentRemaining + 0.01) {
        throw new AppError(`Amount exceeds remaining balance of PKR ${currentRemaining.toFixed(2)}`, 400);
      }

      const newRemaining = Math.max(0, currentRemaining - body.amount);
      const isCleared = newRemaining === 0;

      // Fetch product name for ledger description
      const [instDetail] = await tx
        .select({ productName: products.name, customerName: customers.name })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .innerJoin(products,  eq(installments.productId,  products.id))
        .where(eq(installments.id, body.installmentId));

      const [[payment]] = await Promise.all([
        tx.insert(payments).values({
          installmentId: body.installmentId,
          amount: String(body.amount),
          method: body.method,
          note: body.note,
        }).returning(),
        tx.update(installments).set({
          remaining: String(newRemaining),
          ...(isCleared && { status: 'COMPLETED' }),
        }).where(eq(installments.id, body.installmentId)),
      ]);

      // Auto-post CREDIT to general ledger
      await tx.insert(ledgerEntries).values({
        sellerId,
        type: 'CREDIT',
        category: body.method,
        amount: String(body.amount),
        description: `Payment — ${instDetail?.customerName ?? ''} · ${instDetail?.productName ?? ''}${body.note ? ` · ${body.note}` : ''}`,
        referenceId: payment.id,
        refType: 'PAYMENT',
      });

      return { payment, remaining: newRemaining, completed: isCleared };
    });
  }

  async remove(id: string, sellerId: string, deletedBy: string) {
    const [pmt] = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        installmentId: payments.installmentId,
        instRemaining: installments.remaining,
        instStatus: installments.status,
      })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(eq(payments.id, id), eq(customers.sellerId, sellerId), isNull(payments.deletedAt)));

    if (!pmt) throw new AppError('Payment not found', 404);

    const restoredRemaining = Number(pmt.instRemaining) + Number(pmt.amount);
    // If the installment was COMPLETED and we're restoring balance, revert to ACTIVE
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
    });

    return pmt;
  }
}
