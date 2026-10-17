import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { paymentPromises, customers, installments, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { pktTodaySql } from '../../utils/dueDate.js';
import { staffScopeOrTrue } from '../../utils/staffScope.js';

export type PromiseStatus = 'PENDING' | 'KEPT' | 'KEPT_LATE' | 'BROKEN' | 'CANCELLED';

// Status is derived at read time from whether a payment landed on the installment
// after the promise was logged, and whether the promised date has passed — never
// stored, so a late-but-eventual payment or a promise created yesterday can't
// drift out of sync with reality.
const statusSql = sql<PromiseStatus>`(
  CASE
    WHEN ${paymentPromises.cancelledAt} IS NOT NULL THEN 'CANCELLED'
    WHEN EXISTS (
      SELECT 1 FROM payments p
      WHERE p.installment_id = ${paymentPromises.installmentId}
        AND p.deleted_at IS NULL
        AND p.paid_on >= ${paymentPromises.createdAt}
        AND p.paid_on::date <= ${paymentPromises.promisedDate}
    ) THEN 'KEPT'
    WHEN EXISTS (
      SELECT 1 FROM payments p
      WHERE p.installment_id = ${paymentPromises.installmentId}
        AND p.deleted_at IS NULL
        AND p.paid_on >= ${paymentPromises.createdAt}
    ) THEN 'KEPT_LATE'
    WHEN ${paymentPromises.promisedDate} < ${pktTodaySql} THEN 'BROKEN'
    ELSE 'PENDING'
  END
)`;

export class PaymentPromisesService {
  async list(customerId: string, sellerId: string) {
    return db.select({
      id:             paymentPromises.id,
      installmentId:  paymentPromises.installmentId,
      promisedDate:   paymentPromises.promisedDate,
      promisedAmount: paymentPromises.promisedAmount,
      note:           paymentPromises.note,
      createdAt:      paymentPromises.createdAt,
      createdByName:  users.name,
      cancelledAt:    paymentPromises.cancelledAt,
      status:         statusSql,
    })
      .from(paymentPromises)
      .leftJoin(users, eq(paymentPromises.createdByUserId, users.id))
      .where(and(eq(paymentPromises.customerId, customerId), eq(paymentPromises.sellerId, sellerId)))
      .orderBy(desc(paymentPromises.createdAt));
  }

  async create(customerId: string, sellerId: string, userId: string, body: {
    installmentId: string; promisedDate: string; promisedAmount?: number; note?: string;
  }) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
      columns: { id: true },
    });
    if (!customer) throw new AppError('Customer not found', 404);

    const installment = await db.query.installments.findFirst({
      where: and(eq(installments.id, body.installmentId), eq(installments.customerId, customerId), isNull(installments.deletedAt)),
      columns: { id: true, status: true },
    });
    if (!installment) throw new AppError('Installment not found for this customer', 404);
    if (installment.status !== 'ACTIVE') throw new AppError('Can only log a promise against an active installment', 400);

    const today = new Date().toISOString().slice(0, 10);
    if (body.promisedDate < today) throw new AppError('Promised date cannot be in the past', 400);

    const [inserted] = await db.insert(paymentPromises).values({
      sellerId,
      customerId,
      installmentId: body.installmentId,
      promisedDate: body.promisedDate,
      promisedAmount: body.promisedAmount !== undefined ? String(body.promisedAmount) : null,
      note: body.note?.trim() || null,
      createdByUserId: userId,
    }).returning();
    return inserted;
  }

  async cancel(promiseId: string, sellerId: string, userId: string) {
    const [existing] = await db.select({ id: paymentPromises.id, cancelledAt: paymentPromises.cancelledAt })
      .from(paymentPromises)
      .where(and(eq(paymentPromises.id, promiseId), eq(paymentPromises.sellerId, sellerId)));
    if (!existing) throw new AppError('Promise not found', 404);
    if (existing.cancelledAt) throw new AppError('Promise already cancelled', 400);

    await db.update(paymentPromises)
      .set({ cancelledAt: new Date(), cancelledBy: userId })
      .where(eq(paymentPromises.id, promiseId));
  }

  /** Today's follow-up list: promises due today or already broken, shop-wide (staff-scoped). */
  async followUps(sellerId: string, staffUserId: string | undefined) {
    return db.select({
      id:             paymentPromises.id,
      customerId:     paymentPromises.customerId,
      customerName:   customers.name,
      customerPhone:  customers.phone,
      installmentId:  paymentPromises.installmentId,
      promisedDate:   paymentPromises.promisedDate,
      promisedAmount: paymentPromises.promisedAmount,
      note:           paymentPromises.note,
      createdAt:      paymentPromises.createdAt,
      status:         statusSql,
    })
      .from(paymentPromises)
      .innerJoin(customers, eq(paymentPromises.customerId, customers.id))
      .where(and(
        eq(paymentPromises.sellerId, sellerId),
        isNull(paymentPromises.cancelledAt),
        sql`${paymentPromises.promisedDate} <= ${pktTodaySql}`,
        sql`NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.installment_id = ${paymentPromises.installmentId}
            AND p.deleted_at IS NULL
            AND p.paid_on >= ${paymentPromises.createdAt}
        )`,
        staffScopeOrTrue(staffUserId, 'customers'),
      ))
      .orderBy(desc(paymentPromises.promisedDate));
  }
}
