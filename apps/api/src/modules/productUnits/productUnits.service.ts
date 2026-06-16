import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { productUnits, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import type { CreateProductUnitInput, BulkCreateProductUnitsInput, UpdateProductUnitInput } from '@assaan/shared';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Helper used inside installment / cash-sale transactions ───────────────────
// Atomically claims the unit (available → sold) inside an existing transaction.
// Throws 409 if the IMEI is already sold. Silently returns false if IMEI is not
// registered in inventory (we allow selling unregistered IMEIs for backward-compat).
export async function markUnitSoldInTx(
  tx: Tx,
  imei: string,
  sellerId: string,
  saleType: 'installment' | 'cash',
  soldToName: string,
): Promise<void> {
  const claimed = await tx
    .update(productUnits)
    .set({ status: 'sold', soldAt: new Date(), saleType, soldToName })
    .where(and(
      eq(productUnits.imei, imei),
      eq(productUnits.sellerId, sellerId),
      eq(productUnits.status, 'available'),
      isNull(productUnits.deletedAt),
    ))
    .returning({ id: productUnits.id });

  if (claimed.length === 0) {
    const existing = await tx.query.productUnits.findFirst({
      where: and(
        eq(productUnits.imei, imei),
        eq(productUnits.sellerId, sellerId),
        isNull(productUnits.deletedAt),
      ),
      columns: { status: true, soldToName: true },
    });
    if (existing?.status === 'sold') {
      throw new AppError(
        `IMEI ${imei} is already sold to ${existing.soldToName ?? 'another customer'}`,
        409,
      );
    }
    // defective / returned / not found — allow the sale, just don't update unit
  }
}

// ── Mark unit available again (e.g. when a sale is deleted) ──────────────────
export async function markUnitAvailableInTx(
  tx: Tx,
  imei: string,
  sellerId: string,
): Promise<void> {
  await tx
    .update(productUnits)
    .set({ status: 'available', soldAt: null, saleType: null, soldToName: null })
    .where(and(
      eq(productUnits.imei, imei),
      eq(productUnits.sellerId, sellerId),
      eq(productUnits.status, 'sold'),
      isNull(productUnits.deletedAt),
    ));
}

// ── CRUD service ─────────────────────────────────────────────────────────────
export class ProductUnitsService {
  async list(
    sellerId: string,
    opts: { search?: string; status?: string; productId?: string; page: number; limit: number },
  ) {
    const { search, status, productId, page, limit } = opts;

    const base = and(eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt));
    const filters = [
      base,
      status && status !== 'all' ? eq(productUnits.status, status as 'available' | 'sold' | 'defective' | 'returned') : undefined,
      productId ? eq(productUnits.productId, productId) : undefined,
      search
        ? or(
            ilike(productUnits.imei, `%${search}%`),
            ilike(productUnits.imei2, `%${search}%`),
            ilike(productUnits.soldToName, `%${search}%`),
          )
        : undefined,
    ].filter(Boolean);

    const where = filters.length > 1 ? and(...(filters as Parameters<typeof and>)) : filters[0];

    const [rows, statsRows] = await Promise.all([
      db
        .select({
          id:            productUnits.id,
          imei:          productUnits.imei,
          imei2:         productUnits.imei2,
          color:         productUnits.color,
          storageGb:     productUnits.storageGb,
          condition:     productUnits.condition,
          purchasePrice: productUnits.purchasePrice,
          status:        productUnits.status,
          notes:         productUnits.notes,
          soldAt:        productUnits.soldAt,
          saleType:      productUnits.saleType,
          soldToName:    productUnits.soldToName,
          createdAt:     productUnits.createdAt,
          productId:     productUnits.productId,
          productName:   products.name,
          productBrand:  products.brand,
        })
        .from(productUnits)
        .leftJoin(products, eq(productUnits.productId, products.id))
        .where(where)
        .orderBy(desc(productUnits.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(productUnits).where(where),
    ]);

    return { data: rows, total: statsRows[0]!.count, page, limit };
  }

  async getStats(sellerId: string) {
    const [row] = await db.execute<{
      total: number; available: number; sold: number; defective: number; returned: number;
    }>(sql`
      SELECT
        COUNT(*)::int                                                        AS total,
        COUNT(*) FILTER (WHERE status = 'available')::int                   AS available,
        COUNT(*) FILTER (WHERE status = 'sold')::int                        AS sold,
        COUNT(*) FILTER (WHERE status = 'defective')::int                   AS defective,
        COUNT(*) FILTER (WHERE status = 'returned')::int                    AS returned
      FROM product_units
      WHERE seller_id = ${sellerId} AND deleted_at IS NULL
    `);
    return row ?? { total: 0, available: 0, sold: 0, defective: 0, returned: 0 };
  }

  async lookupImei(imei: string, sellerId: string) {
    const unit = await db
      .select({
        id:           productUnits.id,
        imei:         productUnits.imei,
        imei2:        productUnits.imei2,
        color:        productUnits.color,
        storageGb:    productUnits.storageGb,
        condition:    productUnits.condition,
        status:       productUnits.status,
        soldAt:       productUnits.soldAt,
        saleType:     productUnits.saleType,
        soldToName:   productUnits.soldToName,
        notes:        productUnits.notes,
        productId:    productUnits.productId,
        productName:  products.name,
        productBrand: products.brand,
      })
      .from(productUnits)
      .leftJoin(products, eq(productUnits.productId, products.id))
      .where(and(
        eq(productUnits.imei, imei),
        eq(productUnits.sellerId, sellerId),
        isNull(productUnits.deletedAt),
      ))
      .limit(1);

    if (!unit.length) return { found: false as const, imei };
    return { found: true as const, unit: unit[0]! };
  }

  async create(sellerId: string, body: CreateProductUnitInput) {
    const existing = await db.query.productUnits.findFirst({
      where: and(eq(productUnits.imei, body.imei), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
      columns: { id: true },
    });
    if (existing) throw new AppError(`IMEI ${body.imei} is already registered in your inventory`, 409);

    const [unit] = await db.insert(productUnits).values({
      sellerId,
      productId:     body.productId ?? null,
      imei:          body.imei,
      imei2:         body.imei2 ?? null,
      color:         body.color ?? null,
      storageGb:     body.storageGb ?? null,
      condition:     body.condition,
      purchasePrice: body.purchasePrice != null ? String(body.purchasePrice) : null,
      notes:         body.notes ?? null,
    }).returning();

    return unit!;
  }

  async bulkCreate(
    sellerId: string,
    body: BulkCreateProductUnitsInput,
  ): Promise<{ created: number; skipped: string[] }> {
    const skipped: string[] = [];
    let created = 0;

    for (const imei of body.imeis) {
      const existing = await db.query.productUnits.findFirst({
        where: and(eq(productUnits.imei, imei), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
        columns: { id: true },
      });
      if (existing) { skipped.push(imei); continue; }

      await db.insert(productUnits).values({
        sellerId,
        productId:  body.productId ?? null,
        imei,
        color:      body.color ?? null,
        storageGb:  body.storageGb ?? null,
        condition:  body.condition,
      });
      created++;
    }

    return { created, skipped };
  }

  async update(id: string, sellerId: string, body: UpdateProductUnitInput) {
    const unit = await db.query.productUnits.findFirst({
      where: and(eq(productUnits.id, id), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
      columns: { id: true },
    });
    if (!unit) throw new AppError('Unit not found', 404);

    const patch: Record<string, unknown> = {};
    if (body.status    !== undefined) patch['status']    = body.status;
    if (body.notes     !== undefined) patch['notes']     = body.notes;
    if (body.color     !== undefined) patch['color']     = body.color;
    if (body.storageGb !== undefined) patch['storageGb'] = body.storageGb;
    if (body.productId !== undefined) patch['productId'] = body.productId;
    if (body.condition !== undefined) patch['condition'] = body.condition;

    const [updated] = await db
      .update(productUnits)
      .set(patch)
      .where(eq(productUnits.id, id))
      .returning();

    return updated!;
  }

  async remove(id: string, sellerId: string) {
    const unit = await db.query.productUnits.findFirst({
      where: and(eq(productUnits.id, id), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
      columns: { id: true, status: true },
    });
    if (!unit) throw new AppError('Unit not found', 404);
    if (unit.status === 'sold') throw new AppError('Cannot delete a sold unit — mark it as returned first', 400);

    await db.update(productUnits).set({ deletedAt: new Date() }).where(eq(productUnits.id, id));
  }
}
