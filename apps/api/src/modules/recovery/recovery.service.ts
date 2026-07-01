import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, payments, products, recoveryActions, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

export type ActionType = 'CALLED' | 'VISITED' | 'PROMISE_TO_PAY' | 'REFUSED' | 'LEGAL_WARNING';

type CreateBody = {
  installmentId: string;
  type: ActionType;
  note?: string;
  promiseDate?: string;
};

export class RecoveryService {
  async list(installmentId: string, sellerId: string) {
    // Verify ownership
    const [inst] = await db
      .select({ id: installments.id })
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(eq(installments.id, installmentId), eq(customers.sellerId, sellerId)));

    if (!inst) throw new AppError('Installment not found', 404);

    return db
      .select({
        id:          recoveryActions.id,
        installmentId: recoveryActions.installmentId,
        type:        recoveryActions.type,
        note:        recoveryActions.note,
        promiseDate: recoveryActions.promiseDate,
        createdAt:   recoveryActions.createdAt,
        actorName:   users.name,
        actorRole:   users.role,
      })
      .from(recoveryActions)
      .leftJoin(users, eq(recoveryActions.userId, users.id))
      .where(eq(recoveryActions.installmentId, installmentId))
      .orderBy(desc(recoveryActions.createdAt))
      .limit(200);
  }

  async create(sellerId: string, userId: string, body: CreateBody) {
    // Verify ownership
    const [inst] = await db
      .select({ id: installments.id })
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(eq(installments.id, body.installmentId), eq(customers.sellerId, sellerId)));

    if (!inst) throw new AppError('Installment not found', 404);

    const [action] = await db
      .insert(recoveryActions)
      .values({
        installmentId: body.installmentId,
        sellerId,
        userId,
        type: body.type,
        note: body.note,
        promiseDate: body.promiseDate ? new Date(body.promiseDate) : undefined,
      })
      .returning();

    return action;
  }

  async remove(id: string, sellerId: string) {
    const existing = await db.query.recoveryActions.findFirst({
      where: and(eq(recoveryActions.id, id), eq(recoveryActions.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Action not found', 404);
    await db.delete(recoveryActions).where(eq(recoveryActions.id, id));
  }

  async agentStats(sellerId: string) {
    const staff = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));

    if (staff.length === 0) return [];
    const staffIds = staff.map(s => s.id);

    const stats = await db
      .select({
        collectedBy:     payments.collectedBy,
        totalCollected:  sql<string>`coalesce(sum(${payments.amount}::numeric), 0)::text`,
        collectionCount: sql<number>`count(*)::int`,
        lastCollectedAt: sql<string | null>`max(${payments.paidOn})`,
        thisMonthTotal:  sql<string>`coalesce(sum(case when date_trunc('month', ${payments.paidOn}) = date_trunc('month', now()) then ${payments.amount}::numeric else 0 end), 0)::text`,
        thisMonthCount:  sql<number>`count(case when date_trunc('month', ${payments.paidOn}) = date_trunc('month', now()) then 1 end)::int`,
      })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .where(
        and(
          inArray(payments.collectedBy, staffIds),
          isNull(payments.deletedAt),
          eq(customers.sellerId, sellerId),
        ),
      )
      .groupBy(payments.collectedBy);

    return staff
      .map(s => {
        const stat = stats.find(st => st.collectedBy === s.id);
        return {
          userId:          s.id,
          name:            s.name,
          totalCollected:  Number(stat?.totalCollected  ?? 0),
          collectionCount: stat?.collectionCount ?? 0,
          thisMonthTotal:  Number(stat?.thisMonthTotal  ?? 0),
          thisMonthCount:  stat?.thisMonthCount  ?? 0,
          lastCollectedAt: stat?.lastCollectedAt ?? null,
        };
      })
      .sort((a, b) => b.totalCollected - a.totalCollected);
  }

  async agentCollections(userId: string, sellerId: string, page = 1, limit = 50) {
    const safeLimit = Math.min(limit, 100);
    const offset    = (page - 1) * safeLimit;

    const [agent] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));

    if (!agent) throw new AppError('Agent not found', 404);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id:            payments.id,
          amount:        payments.amount,
          method:        payments.method,
          paidOn:        payments.paidOn,
          note:          payments.note,
          proofImageUrl: payments.proofImageUrl,
          customerName:  customers.name,
          customerPhone: customers.phone,
          productName:   products.name,
          installmentId: payments.installmentId,
        })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers,    eq(installments.customerId, customers.id))
        .innerJoin(products,     eq(installments.productId,  products.id))
        .where(
          and(
            eq(payments.collectedBy, userId),
            isNull(payments.deletedAt),
            eq(customers.sellerId, sellerId),
          ),
        )
        .orderBy(desc(payments.paidOn))
        .limit(safeLimit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .innerJoin(installments, eq(payments.installmentId, installments.id))
        .innerJoin(customers,    eq(installments.customerId, customers.id))
        .where(
          and(
            eq(payments.collectedBy, userId),
            isNull(payments.deletedAt),
            eq(customers.sellerId, sellerId),
          ),
        ),
    ]);

    return { agent, data: rows, total: count, page, limit: safeLimit };
  }

  async promisesDue(sellerId: string) {
    return db
      .select({
        id:            recoveryActions.id,
        installmentId: recoveryActions.installmentId,
        promiseDate:   recoveryActions.promiseDate,
        note:          recoveryActions.note,
        createdAt:     recoveryActions.createdAt,
        customerName:  customers.name,
        customerPhone: customers.phone,
        productName:   products.name,
        actorName:     users.name,
      })
      .from(recoveryActions)
      .innerJoin(installments, eq(recoveryActions.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .innerJoin(products,     eq(installments.productId,  products.id))
      .leftJoin(users,         eq(recoveryActions.userId,  users.id))
      .where(and(
        eq(recoveryActions.sellerId, sellerId),
        eq(recoveryActions.type, 'PROMISE_TO_PAY'),
        sql`${recoveryActions.promiseDate} IS NOT NULL`,
        sql`${recoveryActions.promiseDate}::date <= NOW()::date`,
        eq(installments.status, 'ACTIVE'),
        isNull(installments.deletedAt),
        isNull(customers.deletedAt),
      ))
      .orderBy(asc(recoveryActions.promiseDate))
      .limit(20);
  }

  async allPromises(sellerId: string) {
    const sevenDaysAhead = new Date();
    sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

    return db
      .select({
        id:            recoveryActions.id,
        installmentId: recoveryActions.installmentId,
        promiseDate:   recoveryActions.promiseDate,
        note:          recoveryActions.note,
        createdAt:     recoveryActions.createdAt,
        customerName:  customers.name,
        customerPhone: customers.phone,
        productName:   products.name,
        remaining:     installments.remaining,
        actorName:     users.name,
      })
      .from(recoveryActions)
      .innerJoin(installments, eq(recoveryActions.installmentId, installments.id))
      .innerJoin(customers,    eq(installments.customerId, customers.id))
      .innerJoin(products,     eq(installments.productId,  products.id))
      .leftJoin(users,         eq(recoveryActions.userId,  users.id))
      .where(and(
        eq(recoveryActions.sellerId, sellerId),
        eq(recoveryActions.type, 'PROMISE_TO_PAY'),
        sql`${recoveryActions.promiseDate} IS NOT NULL`,
        sql`${recoveryActions.promiseDate}::date <= ${sevenDaysAhead}`,
        eq(installments.status, 'ACTIVE'),
        isNull(installments.deletedAt),
        isNull(customers.deletedAt),
      ))
      .orderBy(asc(recoveryActions.promiseDate))
      .limit(150);
  }
}
