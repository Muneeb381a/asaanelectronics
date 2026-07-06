import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, ledgerEntries, payments, products, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { clearSellerStatsCache } from '../stats/stats.service.js';

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
          receiptNumber: payments.receiptNumber,
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

  async listBySeller(sellerId: string, from?: string, to?: string) {
    const conds: SQL[] = [eq(customers.sellerId, sellerId), isNull(payments.deletedAt)];
    if (from) conds.push(gte(payments.paidOn, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setUTCHours(23, 59, 59, 999);
      conds.push(lte(payments.paidOn, toDate));
    }
    return db
      .select({
        id:            payments.id,
        amount:        payments.amount,
        method:        payments.method,
        paidOn:        payments.paidOn,
        note:          payments.note,
        customerName:  customers.name,
        customerPhone: customers.phone,
        productName:   products.name,
        collectorName: users.name,
        invoiceNumber: installments.invoiceNumber,
      })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .innerJoin(products,     eq(installments.productId,  products.id))
      .leftJoin(users,         eq(payments.collectedBy,    users.id))
      .where(and(...conds))
      .orderBy(desc(payments.paidOn))
      .limit(1000);
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

      // Generate sequential receipt number per seller per year
      const year = new Date().getFullYear();
      const [{ nextRcp }] = await tx.execute<{ nextRcp: number }>(sql`
        SELECT COALESCE(
          MAX(CAST(SPLIT_PART(p.receipt_number, '-', 3) AS INTEGER)), 0
        ) + 1 AS "nextRcp"
        FROM payments p
        INNER JOIN installments i ON p.installment_id = i.id
        INNER JOIN customers c    ON i.customer_id    = c.id
        WHERE c.seller_id = ${sellerId}
          AND p.receipt_number LIKE ${'RCP-' + year + '-%'}
      `);
      const receiptNumber = `RCP-${year}-${String(nextRcp).padStart(5, '0')}`;

      const [[payment]] = await Promise.all([
        tx.insert(payments).values({
          installmentId: body.installmentId,
          amount:        String(body.amount),
          method:        body.method,
          note:          body.note,
          collectedBy:   body.collectedBy ?? null,
          proofImageUrl: body.proofImageUrl ?? null,
          receiptNumber,
        }).returning(),
        tx.update(installments).set({
          remaining: String(newRemaining),
          ...(isCleared && { status: 'COMPLETED', completedAt: new Date() }),
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

      clearSellerStatsCache(sellerId);
      return { payment, remaining: newRemaining, completed: isCleared };
    });
  }

  async update(id: string, sellerId: string, body: { amount?: number; method?: 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER'; note?: string }) {
    return db.transaction(async (tx) => {
      const [pmt] = await tx
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

      const oldAmount    = Number(pmt.amount);
      const newAmount    = body.amount ?? oldAmount;
      const oldRemaining = Number(pmt.instRemaining);

      // remaining before this payment = currentRemaining + oldAmount
      // new remaining = (remaining before payment) - newAmount
      const newRemaining = oldRemaining + (oldAmount - newAmount);
      if (newRemaining < -0.001) {
        throw new AppError(
          `Amount exceeds balance — max PKR ${(oldRemaining + oldAmount).toFixed(0)}`,
          400,
        );
      }

      const safeRemaining = Math.max(0, newRemaining);
      const wasCompleted  = pmt.instStatus === 'COMPLETED';
      const isCleared     = safeRemaining === 0;
      const statusUpdate  = isCleared && !wasCompleted ? { status: 'COMPLETED' as const, completedAt: new Date() }
                          : !isCleared && wasCompleted  ? { status: 'ACTIVE'    as const, completedAt: null }
                          : {};

      await Promise.all([
        tx.update(payments).set({
          ...(body.amount !== undefined && { amount: String(newAmount) }),
          ...(body.method !== undefined && { method: body.method }),
          ...(body.note   !== undefined && { note: body.note || null }),
        }).where(eq(payments.id, id)),

        tx.update(installments).set({
          remaining: String(safeRemaining.toFixed(2)),
          ...statusUpdate,
        }).where(eq(installments.id, pmt.installmentId)),
      ]);

      if (body.amount !== undefined && body.amount !== oldAmount) {
        await tx.update(ledgerEntries)
          .set({ amount: String(newAmount) })
          .where(and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'PAYMENT')));
      }

      clearSellerStatsCache(sellerId);
      return { id, remaining: safeRemaining, completed: isCleared };
    });
  }

  async remove(id: string, sellerId: string, deletedBy: string, reason?: string) {
    const [pmt] = await db
      .select({
        id:            payments.id,
        amount:        payments.amount,
        method:        payments.method,
        installmentId: payments.installmentId,
        receiptNumber: payments.receiptNumber,
        instRemaining: installments.remaining,
        instStatus:    installments.status,
        customerName:  customers.name,
        productName:   products.name,
      })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .innerJoin(products,     eq(installments.productId,  products.id))
      .where(and(eq(payments.id, id), eq(customers.sellerId, sellerId), isNull(payments.deletedAt)));

    if (!pmt) throw new AppError('Payment not found', 404);

    const restoredRemaining = Number(pmt.instRemaining) + Number(pmt.amount);
    const statusRevert = pmt.instStatus === 'COMPLETED' && restoredRemaining > 0
      ? { status: 'ACTIVE' as const, completedAt: null }
      : {};

    await db.transaction(async (tx) => {
      await tx.update(payments)
        .set({ deletedAt: new Date(), deletedBy, deletedReason: reason ?? null })
        .where(eq(payments.id, id));

      await tx.update(installments)
        .set({ remaining: String(restoredRemaining.toFixed(2)), ...statusRevert })
        .where(eq(installments.id, pmt.installmentId));

      // Replace original ledger entry with a reversal (negative debit) for audit trail
      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'PAYMENT')),
      );
      await tx.insert(ledgerEntries).values({
        sellerId,
        type:        'DEBIT',
        category:    'REVERSAL',
        amount:      pmt.amount,
        description: `Payment reversal${reason ? ': ' + reason : ''} — ${pmt.customerName} · ${pmt.productName}${pmt.receiptNumber ? ' (' + pmt.receiptNumber + ')' : ''}`,
        referenceId: id,
        refType:     'MANUAL',
      });
    });

    clearSellerStatsCache(sellerId);
    return pmt;
  }

  async recordBulk(sellerId: string, entries: CreateBody[]) {
    if (!entries.length) throw new AppError('No entries provided', 400);
    if (entries.length > 100) throw new AppError('Maximum 100 payments per bulk request', 400);

    const succeeded: Array<{ installmentId: string; amount: number }> = [];
    const failed:    Array<{ installmentId: string; error: string }>  = [];

    for (const entry of entries) {
      try {
        await this.record(sellerId, entry);
        succeeded.push({ installmentId: entry.installmentId, amount: entry.amount });
      } catch (err) {
        failed.push({
          installmentId: entry.installmentId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { total: entries.length, succeeded: succeeded.length, failed };
  }
}
