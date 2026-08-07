import { randomUUID } from 'crypto';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { vehicleStock, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type VehicleType = 'BIKE' | 'RICKSHAW' | 'LOADER_RICKSHAW' | 'ELECTRIC_BIKE' | 'ELECTRIC_RICKSHAW';
type VehicleCondition = 'NEW' | 'USED';
type VehicleStockStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD_INSTALLMENT' | 'SOLD_CASH';

type CreateBody = {
  vehicleType:        VehicleType;
  brand:              string;
  model:              string;
  year?:              number;
  color?:             string;
  engineNumber:       string;
  chassisNumber:      string;
  registrationNumber?: string;
  condition?:         VehicleCondition;
  purchasePrice?:     number;
  sellingPrice?:      number;
  supplierName?:      string;
  notes?:             string;
  photoUrl?:          string;
  purchasedAt?:       string;
};

type UpdateBody = Partial<CreateBody> & { status?: VehicleStockStatus };

export class VehicleStockService {
  async list(
    sellerId: string,
    page: number,
    limit: number,
    status?: string,
    vehicleType?: string,
    search?: string,
    condition?: string,
  ) {
    const offset = (page - 1) * limit;
    const conds: SQL[] = [
      eq(vehicleStock.sellerId, sellerId),
      isNull(vehicleStock.deletedAt),
    ];

    if (status) conds.push(eq(vehicleStock.status, status as VehicleStockStatus));
    if (vehicleType) conds.push(eq(vehicleStock.vehicleType, vehicleType as VehicleType));
    if (condition) conds.push(eq(vehicleStock.condition, condition as VehicleCondition));
    if (search) {
      const s = `%${search.trim()}%`;
      conds.push(or(
        ilike(vehicleStock.brand, s),
        ilike(vehicleStock.model, s),
        ilike(vehicleStock.engineNumber, s),
        ilike(vehicleStock.chassisNumber, s),
        ilike(vehicleStock.registrationNumber, s),
        ilike(vehicleStock.color, s),
        ilike(vehicleStock.supplierName, s),
      )!);
    }

    const where = and(...conds);
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(vehicleStock).where(where)
        .orderBy(desc(vehicleStock.createdAt))
        .limit(limit).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(vehicleStock).where(where),
    ]);

    return { data: rows, total, page, limit };
  }

  async stats(sellerId: string) {
    const rows = await db
      .select({
        status: vehicleStock.status,
        count:  sql<number>`count(*)::int`,
      })
      .from(vehicleStock)
      .where(and(eq(vehicleStock.sellerId, sellerId), isNull(vehicleStock.deletedAt)))
      .groupBy(vehicleStock.status);

    const map: Record<string, number> = {};
    rows.forEach((r) => { map[r.status] = r.count; });
    return {
      total:           rows.reduce((s, r) => s + r.count, 0),
      available:       map['AVAILABLE']        ?? 0,
      reserved:        map['RESERVED']         ?? 0,
      soldInstallment: map['SOLD_INSTALLMENT'] ?? 0,
      soldCash:        map['SOLD_CASH']        ?? 0,
    };
  }

  async getOne(id: string, sellerId: string) {
    const [row] = await db.select().from(vehicleStock).where(
      and(eq(vehicleStock.id, id), eq(vehicleStock.sellerId, sellerId), isNull(vehicleStock.deletedAt)),
    );
    if (!row) throw new AppError('Vehicle not found', 404);
    return row;
  }

  async create(sellerId: string, body: CreateBody) {
    // Unique engine/chassis check
    const existing = await db.select({ id: vehicleStock.id }).from(vehicleStock).where(
      and(
        eq(vehicleStock.sellerId, sellerId),
        isNull(vehicleStock.deletedAt),
        or(
          eq(vehicleStock.engineNumber, body.engineNumber),
          eq(vehicleStock.chassisNumber, body.chassisNumber),
        ),
      ),
    );
    if (existing.length > 0) {
      throw new AppError('A vehicle with this engine number or chassis number already exists in stock', 409);
    }

    const [row] = await db.insert(vehicleStock).values({
      id:                 randomUUID(),
      sellerId,
      vehicleType:        body.vehicleType,
      brand:              body.brand.trim(),
      model:              body.model.trim(),
      year:               body.year ?? null,
      color:              body.color?.trim() ?? null,
      engineNumber:       body.engineNumber.trim().toUpperCase(),
      chassisNumber:      body.chassisNumber.trim().toUpperCase(),
      registrationNumber: body.registrationNumber?.trim().toUpperCase() ?? null,
      condition:          body.condition ?? 'NEW',
      purchasePrice:      body.purchasePrice != null ? String(body.purchasePrice) : null,
      sellingPrice:       body.sellingPrice  != null ? String(body.sellingPrice)  : null,
      supplierName:       body.supplierName?.trim() ?? null,
      notes:              body.notes?.trim() ?? null,
      photoUrl:           body.photoUrl ?? null,
      purchasedAt:        body.purchasedAt ?? null,
    }).returning();
    return row;
  }

  async update(id: string, sellerId: string, body: UpdateBody) {
    const [existing] = await db.select().from(vehicleStock).where(
      and(eq(vehicleStock.id, id), eq(vehicleStock.sellerId, sellerId), isNull(vehicleStock.deletedAt)),
    );
    if (!existing) throw new AppError('Vehicle not found', 404);

    // If changing engine/chassis, ensure uniqueness
    if (body.engineNumber || body.chassisNumber) {
      const conflict = await db.select({ id: vehicleStock.id }).from(vehicleStock).where(
        and(
          eq(vehicleStock.sellerId, sellerId),
          isNull(vehicleStock.deletedAt),
          sql`${vehicleStock.id} != ${id}`,
          or(
            body.engineNumber  ? eq(vehicleStock.engineNumber,  body.engineNumber.trim().toUpperCase())  : sql`false`,
            body.chassisNumber ? eq(vehicleStock.chassisNumber, body.chassisNumber.trim().toUpperCase()) : sql`false`,
          ),
        ),
      );
      if (conflict.length > 0) throw new AppError('Engine or chassis number already exists', 409);
    }

    const [updated] = await db.update(vehicleStock).set({
      ...(body.vehicleType        && { vehicleType:        body.vehicleType }),
      ...(body.brand              && { brand:              body.brand.trim() }),
      ...(body.model              && { model:              body.model.trim() }),
      ...(body.year   !== undefined && { year:             body.year ?? null }),
      ...(body.color  !== undefined && { color:            body.color?.trim() ?? null }),
      ...(body.engineNumber       && { engineNumber:       body.engineNumber.trim().toUpperCase() }),
      ...(body.chassisNumber      && { chassisNumber:      body.chassisNumber.trim().toUpperCase() }),
      ...(body.registrationNumber !== undefined && { registrationNumber: body.registrationNumber?.trim().toUpperCase() ?? null }),
      ...(body.condition          && { condition:          body.condition }),
      ...(body.purchasePrice !== undefined && { purchasePrice: body.purchasePrice != null ? String(body.purchasePrice) : null }),
      ...(body.sellingPrice  !== undefined && { sellingPrice:  body.sellingPrice  != null ? String(body.sellingPrice)  : null }),
      ...(body.status             && { status:             body.status }),
      ...(body.supplierName !== undefined && { supplierName: body.supplierName?.trim() ?? null }),
      ...(body.notes        !== undefined && { notes:        body.notes?.trim() ?? null }),
      ...(body.photoUrl     !== undefined && { photoUrl:     body.photoUrl ?? null }),
      ...(body.purchasedAt  !== undefined && { purchasedAt:  body.purchasedAt ?? null }),
      updatedAt: new Date(),
    }).where(eq(vehicleStock.id, id)).returning();
    return updated;
  }

  async delete(id: string, sellerId: string, userId: string) {
    const [row] = await db.select({ status: vehicleStock.status }).from(vehicleStock).where(
      and(eq(vehicleStock.id, id), eq(vehicleStock.sellerId, sellerId), isNull(vehicleStock.deletedAt)),
    );
    if (!row) throw new AppError('Vehicle not found', 404);
    if (row.status === 'SOLD_INSTALLMENT' || row.status === 'RESERVED') {
      throw new AppError('Cannot delete a vehicle that is reserved or on active installment', 400);
    }
    await db.update(vehicleStock).set({
      deletedAt: new Date(),
      deletedBy: userId,
    }).where(eq(vehicleStock.id, id));
  }
}
