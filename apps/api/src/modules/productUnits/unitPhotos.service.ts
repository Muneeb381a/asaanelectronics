import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { productUnitPhotos, productUnits } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

const MAX_PHOTOS_PER_UNIT = 8;

export class UnitPhotosService {
  async list(unitId: string, sellerId: string) {
    const unit = await db.query.productUnits.findFirst({
      where: and(eq(productUnits.id, unitId), eq(productUnits.sellerId, sellerId)),
      columns: { id: true },
    });
    if (!unit) throw new AppError('Unit not found', 404);

    return db.select().from(productUnitPhotos)
      .where(eq(productUnitPhotos.unitId, unitId))
      .orderBy(asc(productUnitPhotos.createdAt));
  }

  async add(unitId: string, sellerId: string, uploadedById: string, url: string, label?: string) {
    const unit = await db.query.productUnits.findFirst({
      where: and(eq(productUnits.id, unitId), eq(productUnits.sellerId, sellerId)),
      columns: { id: true },
    });
    if (!unit) throw new AppError('Unit not found', 404);

    const [{ count: existingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productUnitPhotos)
      .where(eq(productUnitPhotos.unitId, unitId));
    if (existingCount >= MAX_PHOTOS_PER_UNIT) throw new AppError(`Maximum ${MAX_PHOTOS_PER_UNIT} photos per unit`, 400);

    const [photo] = await db.insert(productUnitPhotos).values({
      sellerId, unitId, url, label: label?.trim() || null, uploadedById,
    }).returning();
    return photo!;
  }

  async remove(photoId: string, sellerId: string) {
    const [deleted] = await db.delete(productUnitPhotos)
      .where(and(eq(productUnitPhotos.id, photoId), eq(productUnitPhotos.sellerId, sellerId)))
      .returning();
    if (!deleted) throw new AppError('Photo not found', 404);
    return deleted;
  }
}
