import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { repossessions, customers, installments, products, ledgerEntries } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type RepoStatus = 'in_stock' | 'sold' | 'disposed' | 'returned';

export interface CreateRepossessionBody {
  installmentId:   string;
  repossessedDate: string; // ISO date YYYY-MM-DD
  deviceName:      string;
  imei?:           string;
  condition:       'good' | 'fair' | 'poor';
  reason?:         string;
  amountRecovered?: number;
  assessedValue?:  number;
  notes?:          string;
}

export interface UpdateRepossessionBody {
  status?:      RepoStatus;
  soldPrice?:   number;
  condition?:   'good' | 'fair' | 'poor';
  notes?:       string;
  assessedValue?: number;
}

export class RepossessionsService {
  async list(sellerId: string, opts: { status?: string; page: number; limit: number }) {
    const { status, page, limit } = opts;

    const where = and(
      eq(repossessions.sellerId, sellerId),
      status && status !== 'all' ? eq(repossessions.status, status) : undefined,
    );

    const [rows, [countRow]] = await Promise.all([
      db
        .select({
          id:              repossessions.id,
          sellerId:        repossessions.sellerId,
          installmentId:   repossessions.installmentId,
          customerId:      repossessions.customerId,
          repossessedDate: repossessions.repossessedDate,
          deviceName:      repossessions.deviceName,
          imei:            repossessions.imei,
          condition:       repossessions.condition,
          reason:          repossessions.reason,
          amountRecovered:           repossessions.amountRecovered,
          outstandingAtRepossession: repossessions.outstandingAtRepossession,
          assessedValue:   repossessions.assessedValue,
          status:          repossessions.status,
          soldPrice:       repossessions.soldPrice,
          soldAt:          repossessions.soldAt,
          notes:           repossessions.notes,
          createdAt:       repossessions.createdAt,
          customerName:    customers.name,
          customerPhone:   customers.phone,
        })
        .from(repossessions)
        .leftJoin(customers, eq(repossessions.customerId, customers.id))
        .where(where)
        .orderBy(desc(repossessions.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(repossessions).where(where),
    ]);

    return { data: rows, total: countRow?.count ?? 0, page, limit };
  }

  async getStats(sellerId: string) {
    const [row] = await db.execute<{
      total: number; in_stock: number; sold: number; disposed: number; returned: number;
      total_outstanding: string; total_recovered: string; total_sold: string;
    }>(sql`
      SELECT
        COUNT(*)::int                                                 AS total,
        COUNT(*) FILTER (WHERE status = 'in_stock')::int             AS in_stock,
        COUNT(*) FILTER (WHERE status = 'sold')::int                 AS sold,
        COUNT(*) FILTER (WHERE status = 'disposed')::int             AS disposed,
        COUNT(*) FILTER (WHERE status = 'returned')::int             AS returned,
        COALESCE(SUM(outstanding_at_repossession)::text, '0')        AS total_outstanding,
        COALESCE(SUM(amount_recovered)::text, '0')                   AS total_recovered,
        COALESCE(SUM(sold_price) FILTER (WHERE status='sold')::text, '0') AS total_sold
      FROM repossessions
      WHERE seller_id = ${sellerId}
    `);
    return row ?? { total: 0, in_stock: 0, sold: 0, disposed: 0, returned: 0, total_outstanding: '0', total_recovered: '0', total_sold: '0' };
  }

  async create(sellerId: string, body: CreateRepossessionBody) {
    // Verify the installment belongs to this seller and get customer + product info
    const [instRow] = await db.execute<{
      id: string; customer_id: string; remaining: string; product_name: string; imei_number: string | null; product_id: string;
    }>(sql`
      SELECT i.id, i.customer_id, i.remaining, p.name AS product_name, i.imei_number, i.product_id
      FROM installments i
      JOIN customers c ON c.id = i.customer_id
      JOIN products p ON p.id = i.product_id
      WHERE i.id = ${body.installmentId}
        AND c.seller_id = ${sellerId}
        AND i.deleted_at IS NULL
    `);
    if (!instRow) throw new AppError('Installment not found', 404);

    // Check not already repossessed
    const existing = await db.query.repossessions.findFirst({
      where: and(eq(repossessions.installmentId, body.installmentId), eq(repossessions.sellerId, sellerId)),
      columns: { id: true },
    });
    if (existing) throw new AppError('This installment has already been repossessed', 409);

    // Create repossession + update installment status + restore stock in one transaction
    const [repo] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(repossessions).values({
        sellerId,
        installmentId:             body.installmentId,
        customerId:                instRow.customer_id,
        repossessedDate:           body.repossessedDate,
        deviceName:                body.deviceName,
        imei:                      body.imei ?? instRow.imei_number ?? null,
        condition:                 body.condition,
        reason:                    body.reason ?? null,
        amountRecovered:           String(body.amountRecovered ?? 0),
        outstandingAtRepossession: instRow.remaining,
        assessedValue:             body.assessedValue != null ? String(body.assessedValue) : null,
        notes:                     body.notes ?? null,
      }).returning();

      // Mark installment as CLOSED
      await tx.update(installments)
        .set({ status: 'CLOSED' })
        .where(eq(installments.id, body.installmentId));

      // Restore product stock — device is physically back in shop
      await tx.update(products)
        .set({ stock: sql`${products.stock} + 1` })
        .where(eq(products.id, instRow.product_id));

      // Ledger DEBIT for any amount recovered (cash paid by customer at repossession)
      if ((body.amountRecovered ?? 0) > 0) {
        await tx.insert(ledgerEntries).values({
          sellerId,
          type:        'CREDIT',
          category:    'REPOSSESSION',
          amount:      String(body.amountRecovered),
          description: `Repossession recovery — ${instRow.product_name}`,
          referenceId: row!.id,
          refType:     'MANUAL',
        });
      }

      return [row!];
    });

    return repo;
  }

  async update(id: string, sellerId: string, body: UpdateRepossessionBody) {
    const existing = await db.query.repossessions.findFirst({
      where: and(eq(repossessions.id, id), eq(repossessions.sellerId, sellerId)),
      columns: { id: true, status: true, deviceName: true },
    });
    if (!existing) throw new AppError('Repossession not found', 404);

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
      const [updated] = await tx.update(repossessions).set(patch).where(eq(repossessions.id, id)).returning();

      // When marked as sold — ledger CREDIT for sale proceeds; stock -1 (leaving shop again)
      if (body.status === 'sold' && existing.status !== 'sold' && body.soldPrice) {
        await tx.update(products)
          .set({ stock: sql`GREATEST(${products.stock} - 1, 0)` })
          .where(eq(
            products.id,
            sql`(SELECT product_id FROM installments WHERE id = (SELECT installment_id FROM repossessions WHERE id = ${id}))`,
          ));
        await tx.insert(ledgerEntries).values({
          sellerId,
          type:        'CREDIT',
          category:    'REPOSSESSION',
          amount:      String(body.soldPrice),
          description: `Repossessed device sold — ${existing.deviceName}`,
          referenceId: id,
          refType:     'MANUAL',
        });
      }

      return updated!;
    });
  }

  async remove(id: string, sellerId: string) {
    const existing = await db.query.repossessions.findFirst({
      where: and(eq(repossessions.id, id), eq(repossessions.sellerId, sellerId)),
      columns: { id: true },
    });
    if (!existing) throw new AppError('Repossession not found', 404);
    await db.delete(repossessions).where(eq(repossessions.id, id));
  }
}
