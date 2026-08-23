import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { tradeIns, customers, ledgerEntries } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type TradeInStatus = 'in_stock' | 'sold' | 'disposed';
type Condition     = 'good' | 'fair' | 'poor';

export interface CreateTradeInBody {
  customerId?:    string;
  installmentId?: string;
  cashSaleId?:    string;
  deviceName:     string;
  brand?:         string;
  model?:         string;
  imei?:          string;
  color?:         string;
  storageGb?:     number;
  condition:      Condition;
  assessedValue:  number;
  notes?:         string;
}

export interface UpdateTradeInBody {
  status?:     TradeInStatus;
  soldPrice?:  number;
  condition?:  Condition;
  notes?:      string;
  assessedValue?: number;
}

export class TradeInsService {
  async list(sellerId: string, opts: { status?: string; page: number; limit: number }) {
    const { status, page, limit } = opts;

    const where = and(
      eq(tradeIns.sellerId, sellerId),
      status && status !== 'all' ? eq(tradeIns.status, status) : undefined,
    );

    const [rows, [countRow]] = await Promise.all([
      db
        .select({
          id:            tradeIns.id,
          sellerId:      tradeIns.sellerId,
          customerId:    tradeIns.customerId,
          installmentId: tradeIns.installmentId,
          cashSaleId:    tradeIns.cashSaleId,
          deviceName:    tradeIns.deviceName,
          brand:         tradeIns.brand,
          model:         tradeIns.model,
          imei:          tradeIns.imei,
          color:         tradeIns.color,
          storageGb:     tradeIns.storageGb,
          condition:     tradeIns.condition,
          assessedValue: tradeIns.assessedValue,
          notes:         tradeIns.notes,
          status:        tradeIns.status,
          soldPrice:     tradeIns.soldPrice,
          soldAt:        tradeIns.soldAt,
          createdAt:     tradeIns.createdAt,
          customerName:  customers.name,
          customerPhone: customers.phone,
        })
        .from(tradeIns)
        .leftJoin(customers, eq(tradeIns.customerId, customers.id))
        .where(where)
        .orderBy(desc(tradeIns.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(tradeIns).where(where),
    ]);

    return { data: rows, total: countRow?.count ?? 0, page, limit };
  }

  async getStats(sellerId: string) {
    const [row] = await db.execute<{
      total: number; in_stock: number; sold: number; disposed: number; total_assessed: string; total_sold: string;
    }>(sql`
      SELECT
        COUNT(*)::int                                               AS total,
        COUNT(*) FILTER (WHERE status = 'in_stock')::int           AS in_stock,
        COUNT(*) FILTER (WHERE status = 'sold')::int               AS sold,
        COUNT(*) FILTER (WHERE status = 'disposed')::int           AS disposed,
        COALESCE(SUM(assessed_value)::text, '0')                   AS total_assessed,
        COALESCE(SUM(sold_price) FILTER (WHERE status = 'sold')::text, '0') AS total_sold
      FROM trade_ins
      WHERE seller_id = ${sellerId}
    `);
    return row ?? { total: 0, in_stock: 0, sold: 0, disposed: 0, total_assessed: '0', total_sold: '0' };
  }

  async create(sellerId: string, body: CreateTradeInBody) {
    return db.transaction(async (tx) => {
      const [row] = await tx.insert(tradeIns).values({
        sellerId,
        customerId:    body.customerId    ?? null,
        installmentId: body.installmentId ?? null,
        cashSaleId:    body.cashSaleId    ?? null,
        deviceName:    body.deviceName,
        brand:         body.brand         ?? null,
        model:         body.model         ?? null,
        imei:          body.imei          ?? null,
        color:         body.color         ?? null,
        storageGb:     body.storageGb     ?? null,
        condition:     body.condition,
        assessedValue: String(body.assessedValue),
        notes:         body.notes         ?? null,
      }).returning();

      // Ledger DEBIT — money paid out to customer as trade-in value
      if (body.assessedValue > 0) {
        const label = [body.brand, body.model, body.deviceName].filter(Boolean).join(' ');
        await tx.insert(ledgerEntries).values({
          sellerId,
          type:        'DEBIT',
          category:    'TRADE_IN',
          amount:      String(body.assessedValue),
          description: `Trade-in purchase — ${label}`,
          referenceId: row!.id,
          refType:     'MANUAL',
        });
      }

      return row!;
    });
  }

  async update(id: string, sellerId: string, body: UpdateTradeInBody) {
    const existing = await db.query.tradeIns.findFirst({
      where: and(eq(tradeIns.id, id), eq(tradeIns.sellerId, sellerId)),
      columns: { id: true, status: true, deviceName: true, brand: true, model: true },
    });
    if (!existing) throw new AppError('Trade-in not found', 404);

    const patch: Record<string, unknown> = {};
    if (body.status        !== undefined) patch['status']        = body.status;
    if (body.condition     !== undefined) patch['condition']     = body.condition;
    if (body.notes         !== undefined) patch['notes']         = body.notes;
    if (body.assessedValue !== undefined) patch['assessedValue'] = String(body.assessedValue);
    if (body.soldPrice     !== undefined) {
      patch['soldPrice'] = String(body.soldPrice);
      if (body.status === 'sold') patch['soldAt'] = new Date();
    }

    return db.transaction(async (tx) => {
      const [updated] = await tx.update(tradeIns).set(patch).where(eq(tradeIns.id, id)).returning();

      // When marked as sold — ledger CREDIT for sale proceeds
      if (body.status === 'sold' && existing.status !== 'sold' && body.soldPrice) {
        const label = [existing.brand, existing.model, existing.deviceName].filter(Boolean).join(' ');
        await tx.insert(ledgerEntries).values({
          sellerId,
          type:        'CREDIT',
          category:    'TRADE_IN',
          amount:      String(body.soldPrice),
          description: `Trade-in device sold — ${label}`,
          referenceId: id,
          refType:     'MANUAL',
        });
      }

      return updated!;
    });
  }

  async remove(id: string, sellerId: string) {
    const existing = await db.query.tradeIns.findFirst({
      where: and(eq(tradeIns.id, id), eq(tradeIns.sellerId, sellerId)),
      columns: { id: true },
    });
    if (!existing) throw new AppError('Trade-in not found', 404);
    await db.delete(tradeIns).where(eq(tradeIns.id, id));
  }
}
