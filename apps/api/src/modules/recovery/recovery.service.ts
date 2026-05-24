import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, recoveryActions, users } from '../../db/schema.js';
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
      .orderBy(desc(recoveryActions.createdAt));
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
}
