import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customerDocuments } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

const ALLOWED_TYPES = ['SALARY_SLIP', 'UTILITY_BILL', 'EMPLOYMENT_LETTER', 'INCOME_TAX', 'OTHER'] as const;
type DocType = (typeof ALLOWED_TYPES)[number];
type DocStatus = 'PENDING' | 'RECEIVED' | 'VERIFIED';

export class CustomerDocumentsService {
  async list(customerId: string, sellerId: string) {
    return db.select().from(customerDocuments)
      .where(and(eq(customerDocuments.customerId, customerId), eq(customerDocuments.sellerId, sellerId)))
      .orderBy(asc(customerDocuments.createdAt));
  }

  async add(customerId: string, sellerId: string, userId: string, body: {
    docType: DocType;
    label: string;
    status?: DocStatus;
    notes?: string;
  }) {
    if (!ALLOWED_TYPES.includes(body.docType)) throw new AppError('Invalid doc type', 400);
    if (!body.label?.trim()) throw new AppError('Label is required', 400);

    const [doc] = await db.insert(customerDocuments).values({
      customerId,
      sellerId,
      docType: body.docType,
      label: body.label.trim(),
      status: body.status ?? 'RECEIVED',
      notes: body.notes?.trim() || null,
      addedBy: userId,
    }).returning();
    return doc!;
  }

  async update(id: string, customerId: string, sellerId: string, body: {
    status?: DocStatus;
    notes?: string;
    label?: string;
  }) {
    const existing = await db.query.customerDocuments.findFirst({
      where: and(
        eq(customerDocuments.id, id),
        eq(customerDocuments.customerId, customerId),
        eq(customerDocuments.sellerId, sellerId),
      ),
    });
    if (!existing) throw new AppError('Document not found', 404);

    const [updated] = await db.update(customerDocuments).set({
      ...(body.status !== undefined && { status: body.status }),
      ...(body.notes  !== undefined && { notes: body.notes?.trim() || null }),
      ...(body.label  !== undefined && { label: body.label.trim() }),
    }).where(eq(customerDocuments.id, id)).returning();
    return updated!;
  }

  async remove(id: string, customerId: string, sellerId: string) {
    const existing = await db.query.customerDocuments.findFirst({
      where: and(
        eq(customerDocuments.id, id),
        eq(customerDocuments.customerId, customerId),
        eq(customerDocuments.sellerId, sellerId),
      ),
    });
    if (!existing) throw new AppError('Document not found', 404);
    await db.delete(customerDocuments).where(eq(customerDocuments.id, id));
    return existing;
  }
}
