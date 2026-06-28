import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { whatsappTemplates } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type UpsertBody = { name: string; body: string };

export class WhatsappTemplatesService {
  async list(sellerId: string) {
    return db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.sellerId, sellerId))
      .orderBy(asc(whatsappTemplates.createdAt));
  }

  async create(sellerId: string, body: UpsertBody) {
    if (!body.name?.trim()) throw new AppError('Template name is required', 400);
    if (!body.body?.trim())  throw new AppError('Template body is required', 400);
    const [row] = await db
      .insert(whatsappTemplates)
      .values({ sellerId, name: body.name.trim(), body: body.body.trim() })
      .returning();
    return row;
  }

  async update(id: string, sellerId: string, body: UpsertBody) {
    const existing = await db.query.whatsappTemplates.findFirst({
      where: and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Template not found', 404);
    if (!body.name?.trim()) throw new AppError('Template name is required', 400);
    if (!body.body?.trim())  throw new AppError('Template body is required', 400);
    const [row] = await db
      .update(whatsappTemplates)
      .set({ name: body.name.trim(), body: body.body.trim() })
      .where(eq(whatsappTemplates.id, id))
      .returning();
    return row;
  }

  async remove(id: string, sellerId: string) {
    const existing = await db.query.whatsappTemplates.findFirst({
      where: and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Template not found', 404);
    await db.delete(whatsappTemplates).where(eq(whatsappTemplates.id, id));
  }
}
