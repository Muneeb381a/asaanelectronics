import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { productUnits, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import type { CreateProductUnitInput, BulkCreateProductUnitsInput, UpdateProductUnitInput } from '@assaan/shared';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Tx | typeof db;

/** A sale can quote IMEI 1, IMEI 2, chassis (serialNumber) or engine number. */
export function serialMatch(serial: string) {
  const s = serial.trim();
  return or(
    eq(productUnits.imei, s),
    eq(productUnits.imei2, s),
    sql`upper(${productUnits.serialNumber}) = upper(${s})`,
    sql`upper(${productUnits.engineNumber}) = upper(${s})`,
  )!;
}

/** True when the product tracks physical units (phones by IMEI, vehicles by chassis/engine). */
export async function productHasUnits(ex: Executor, productId: string, sellerId: string): Promise<boolean> {
  const [row] = await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(productUnits)
    .where(and(eq(productUnits.productId, productId), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)));
  return (row?.n ?? 0) > 0;
}

// ── Claim a unit inside an installment / cash-sale transaction ───────────────
// Resolves the quoted serial to a registered unit and marks it sold.
// - unit belongs to a different product        → 400
// - unit already sold                            → 409
// - unit defective / returned                    → 400
// - serial not registered at all                 → { claimed: false } (caller decides
//   whether that is allowed: serialized products reject, loose stock accepts)
export async function markUnitSoldInTx(
  tx: Tx,
  serial: string,
  sellerId: string,
  saleType: 'installment' | 'cash',
  soldToName: string,
  productId?: string,
): Promise<{ claimed: boolean; unitId?: string }> {
  const unit = await tx
    .select({ id: productUnits.id, status: productUnits.status, soldToName: productUnits.soldToName, productId: productUnits.productId, productName: products.name })
    .from(productUnits)
    .leftJoin(products, eq(productUnits.productId, products.id))
    .where(and(eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt), serialMatch(serial)))
    .limit(1)
    .then((r) => r[0]);

  if (!unit) return { claimed: false };
  if (unit.status === 'sold') throw new AppError(`Ye unit (${serial.trim()}) pehle hi ${unit.soldToName ?? 'kisi aur customer'} ko bik chuka hai`, 409);
  if (unit.status !== 'available') throw new AppError(`Ye unit inventory mein "${unit.status}" mark hai — bech nahi sakte`, 400);
  if (productId && unit.productId && unit.productId !== productId) {
    throw new AppError(`Ye number "${unit.productName ?? 'doosre product'}" ka hai — sahi product chunein`, 400);
  }

  await tx
    .update(productUnits)
    .set({ status: 'sold', soldAt: new Date(), saleType, soldToName, ...(productId && !unit.productId ? { productId } : {}) })
    .where(eq(productUnits.id, unit.id));
  return { claimed: true, unitId: unit.id };
}

// ── Mark unit available again (e.g. when a sale is deleted) ──────────────────
export async function markUnitAvailableInTx(tx: Tx, serial: string, sellerId: string): Promise<void> {
  await tx
    .update(productUnits)
    .set({ status: 'available', soldAt: null, saleType: null, soldToName: null })
    .where(and(eq(productUnits.sellerId, sellerId), eq(productUnits.status, 'sold'), isNull(productUnits.deletedAt), serialMatch(serial)));
}

/** Registers units for freshly received stock (one row per physical item). Existing serials are skipped. */
export async function registerUnitsInTx(
  tx: Tx,
  sellerId: string,
  rows: Array<{ productId: string; imei?: string | null; imei2?: string | null; chassisNumber?: string | null; engineNumber?: string | null; serial?: string | null; color?: string | null; purchasePrice?: number | null }>,
): Promise<number> {
  let created = 0;
  for (const r of rows) {
    const imei = r.imei?.trim();
    const chassis = r.chassisNumber?.trim();
    const serial = r.serial?.trim();
    const key = imei || chassis || serial;
    if (!key) continue;
    const dup = await tx.select({ id: productUnits.id }).from(productUnits)
      .where(and(eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt), serialMatch(key))).limit(1);
    if (dup.length) continue;
    await tx.insert(productUnits).values({
      sellerId,
      productId:     r.productId,
      serialType:    imei ? 'imei' : chassis ? 'chassis_engine' : 'serial',
      imei:          imei || null,
      imei2:         imei ? (r.imei2?.trim() || null) : null,
      serialNumber:  imei ? null : (chassis || serial || null),
      engineNumber:  chassis ? (r.engineNumber?.trim() || null) : null,
      color:         r.color ?? null,
      purchasePrice: r.purchasePrice != null ? String(r.purchasePrice) : null,
    });
    created++;
  }
  return created;
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
            ilike(productUnits.serialNumber, `%${search}%`),
            ilike(productUnits.soldToName, `%${search}%`),
          )
        : undefined,
    ].filter(Boolean);

    const where = filters.length > 1 ? and(...(filters as Parameters<typeof and>)) : filters[0];

    const [rows, statsRows] = await Promise.all([
      db
        .select({
          id:            productUnits.id,
          serialType:    productUnits.serialType,
          imei:          productUnits.imei,
          imei2:         productUnits.imei2,
          serialNumber:  productUnits.serialNumber,
          color:         productUnits.color,
          storageGb:     productUnits.storageGb,
          condition:     productUnits.condition,
          purchasePrice: productUnits.purchasePrice,
          status:        productUnits.status,
          notes:         productUnits.notes,
          ptaStatus:     productUnits.ptaStatus,
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
        serialType:   productUnits.serialType,
        imei:         productUnits.imei,
        imei2:        productUnits.imei2,
        serialNumber: productUnits.serialNumber,
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
        eq(productUnits.sellerId, sellerId),
        isNull(productUnits.deletedAt),
        serialMatch(imei),
      ))
      .limit(1);

    if (!unit.length) return { found: false as const, imei };
    return { found: true as const, unit: unit[0]! };
  }

  async create(sellerId: string, body: CreateProductUnitInput) {
    const isImei = body.serialType === 'imei';

    if (isImei && body.imei) {
      const existing = await db.query.productUnits.findFirst({
        where: and(eq(productUnits.imei, body.imei), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
        columns: { id: true },
      });
      if (existing) throw new AppError(`IMEI ${body.imei} is already registered in your inventory`, 409);
    }

    if (!isImei && body.serialNumber) {
      const existing = await db.query.productUnits.findFirst({
        where: and(eq(productUnits.serialNumber, body.serialNumber), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
        columns: { id: true },
      });
      if (existing) throw new AppError(`Serial number ${body.serialNumber} is already registered in your inventory`, 409);
    }

    const [unit] = await db.insert(productUnits).values({
      sellerId,
      serialType:    body.serialType,
      productId:     body.productId ?? null,
      imei:          isImei ? (body.imei ?? null) : null,
      imei2:         isImei ? (body.imei2 ?? null) : null,
      serialNumber:  !isImei ? (body.serialNumber ?? null) : null,
      engineNumber:  body.serialType === 'chassis_engine' ? (body.engineNumber ?? null) : null,
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
    const unique = [...new Set(body.imeis)];
    const existing = await db
      .select({ imei: productUnits.imei })
      .from(productUnits)
      .where(and(eq(productUnits.sellerId, sellerId), inArray(productUnits.imei, unique), isNull(productUnits.deletedAt)));
    const taken   = new Set(existing.map((r) => r.imei));
    const skipped = unique.filter((i) => taken.has(i));
    const fresh   = unique.filter((i) => !taken.has(i));

    if (fresh.length > 0) {
      await db.insert(productUnits).values(fresh.map((imei) => ({
        sellerId,
        productId:  body.productId ?? null,
        imei,
        color:      body.color ?? null,
        storageGb:  body.storageGb ?? null,
        condition:  body.condition,
      })));
    }

    return { created: fresh.length, skipped };
  }

  async update(id: string, sellerId: string, body: UpdateProductUnitInput) {
    const unit = await db.query.productUnits.findFirst({
      where: and(eq(productUnits.id, id), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
      columns: { id: true, status: true, productId: true },
    });
    if (!unit) throw new AppError('Unit not found', 404);

    const patch: Record<string, unknown> = {};
    if (body.status    !== undefined) patch['status']    = body.status;
    if (body.notes     !== undefined) patch['notes']     = body.notes;
    if (body.color     !== undefined) patch['color']     = body.color;
    if (body.storageGb !== undefined) patch['storageGb'] = body.storageGb;
    if (body.productId !== undefined) patch['productId'] = body.productId;
    if (body.condition !== undefined) patch['condition'] = body.condition;
    if (body.ptaStatus !== undefined) patch['ptaStatus'] = body.ptaStatus;
    if (body.status !== undefined && body.status !== 'sold' && unit.status === 'sold') {
      Object.assign(patch, { soldAt: null, saleType: null, soldToName: null });
    }

    return db.transaction(async (tx) => {
      const [updated] = await tx.update(productUnits).set(patch).where(eq(productUnits.id, id)).returning();

      // Product stock mirrors available units: leaving/entering "available" moves the count.
      const productId = (body.productId !== undefined ? body.productId : unit.productId) ?? null;
      if (productId && body.status !== undefined && body.status !== unit.status) {
        if (unit.status === 'available' && body.status !== 'available') {
          await tx.update(products).set({ stock: sql`GREATEST(${products.stock} - 1, 0)` }).where(eq(products.id, productId));
        } else if (unit.status !== 'available' && body.status === 'available') {
          await tx.update(products).set({ stock: sql`${products.stock} + 1` }).where(eq(products.id, productId));
        }
      }
      return updated!;
    });
  }

  async remove(id: string, sellerId: string) {
    const unit = await db.query.productUnits.findFirst({
      where: and(eq(productUnits.id, id), eq(productUnits.sellerId, sellerId), isNull(productUnits.deletedAt)),
      columns: { id: true, status: true, productId: true },
    });
    if (!unit) throw new AppError('Unit not found', 404);
    if (unit.status === 'sold') throw new AppError('Cannot delete a sold unit — mark it as returned first', 400);

    await db.transaction(async (tx) => {
      await tx.update(productUnits).set({ deletedAt: new Date() }).where(eq(productUnits.id, id));
      if (unit.status === 'available' && unit.productId) {
        await tx.update(products).set({ stock: sql`GREATEST(${products.stock} - 1, 0)` }).where(eq(products.id, unit.productId));
      }
    });
  }

  async checkPta(imei: string): Promise<{
    status: 'OK' | 'UNAVAILABLE';
    registered?: boolean;
    statusMessage?: string;
    message?: string;
  }> {
    try {
      const url = `https://id.pta.gov.pk/dirbs-api/api/v5/imei/?imei=${encodeURIComponent(imei)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { status: 'UNAVAILABLE', message: `PTA API returned ${res.status}` };

      const data = await res.json() as {
        registration_status?: { status_message?: string; verified_imei?: boolean };
        stolen_status?: unknown;
      };

      const statusMessage = data.registration_status?.status_message ?? 'Unknown';
      const registered    = statusMessage.toLowerCase() === 'approved';

      return { status: 'OK', registered, statusMessage };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      return {
        status: 'UNAVAILABLE',
        message: msg.includes('abort') || msg.includes('timeout')
          ? 'PTA API timeout — try again'
          : 'PTA DIRBS API unreachable',
      };
    }
  }
}
