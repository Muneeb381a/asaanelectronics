import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customerNotes, customers, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

export class CustomerNotesService {
  async list(customerId: string, sellerId: string, page: number, limit: number) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
      columns: { id: true },
    });
    if (!customer) throw new AppError('Customer not found', 404);

    const where = and(eq(customerNotes.customerId, customerId), isNull(customerNotes.deletedAt));

    const [data, [{ total }]] = await Promise.all([
      db
        .select({
          id: customerNotes.id,
          note: customerNotes.note,
          createdAt: customerNotes.createdAt,
          userId: customerNotes.userId,
          authorName: users.name,
        })
        .from(customerNotes)
        .leftJoin(users, eq(customerNotes.userId, users.id))
        .where(where)
        .orderBy(desc(customerNotes.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(customerNotes)
        .where(where),
    ]);

    return { data, total, page, limit };
  }

  async add(customerId: string, sellerId: string, userId: string, note: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
      columns: { id: true },
    });
    if (!customer) throw new AppError('Customer not found', 404);
    if (!note.trim()) throw new AppError('Note cannot be empty', 400);
    if (note.length > 500) throw new AppError('Note cannot exceed 500 characters', 400);

    const [inserted] = await db.insert(customerNotes).values({
      customerId,
      sellerId,
      userId,
      note: note.trim(),
    }).returning();
    return inserted;
  }

  async remove(noteId: string, sellerId: string, deletedBy: string) {
    const [note] = await db
      .select({ id: customerNotes.id })
      .from(customerNotes)
      .where(and(eq(customerNotes.id, noteId), eq(customerNotes.sellerId, sellerId), isNull(customerNotes.deletedAt)));

    if (!note) throw new AppError('Note not found', 404);

    await db.update(customerNotes)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(customerNotes.id, noteId));
  }
}
