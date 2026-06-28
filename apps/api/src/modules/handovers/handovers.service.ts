import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { staffHandovers } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

export class HandoversService {
  async list(sellerId: string, staffId?: string, date?: string) {
    type Row = {
      id: string; sellerId: string; staffId: string;
      handedAmount: string; confirmedAmount: string | null;
      note: string | null; ownerNote: string | null;
      status: string; handoverDate: Date; confirmedAt: Date | null;
      confirmedById: string | null; createdAt: Date;
      staffName: string; staffEmail: string;
      confirmedByName: string | null;
    };

    let whereClause = sql`h.seller_id = ${sellerId}`;
    if (staffId) whereClause = sql`${whereClause} AND h.staff_id = ${staffId}`;
    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      whereClause = sql`${whereClause} AND h.handover_date >= ${start} AND h.handover_date < ${end}`;
    }

    return db.execute<Row>(sql`
      SELECT
        h.id, h.seller_id AS "sellerId", h.staff_id AS "staffId",
        h.handed_amount AS "handedAmount", h.confirmed_amount AS "confirmedAmount",
        h.note, h.owner_note AS "ownerNote", h.status,
        h.handover_date AS "handoverDate", h.confirmed_at AS "confirmedAt",
        h.confirmed_by_id AS "confirmedById", h.created_at AS "createdAt",
        su.name AS "staffName", su.email AS "staffEmail",
        cu.name AS "confirmedByName"
      FROM staff_handovers h
      LEFT JOIN users su ON su.id = h.staff_id
      LEFT JOIN users cu ON cu.id = h.confirmed_by_id
      WHERE ${whereClause}
      ORDER BY h.created_at DESC
    `);
  }

  async collectedToday(sellerId: string, staffId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [payRes] = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      JOIN installments i ON i.id = p.installment_id
      WHERE i.seller_id = ${sellerId}
        AND p.collected_by = ${staffId}
        AND p.paid_on >= ${todayStart}
        AND p.deleted_at IS NULL
        AND p.method = 'CASH'
    `);

    const [saleRes] = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM cash_sales
      WHERE seller_id = ${sellerId}
        AND sold_by_user_id = ${staffId}
        AND created_at >= ${todayStart}
        AND method = 'CASH'
    `);

    return Number(payRes?.total ?? 0) + Number(saleRes?.total ?? 0);
  }

  async create(sellerId: string, staffId: string, body: { handedAmount: number; note?: string; handoverDate?: string }) {
    if (!body.handedAmount || body.handedAmount <= 0) throw new AppError('Amount must be greater than 0', 400);
    const date = body.handoverDate ? new Date(body.handoverDate) : new Date();
    const [row] = await db.insert(staffHandovers).values({
      sellerId,
      staffId,
      handedAmount: String(body.handedAmount),
      note: body.note?.trim() || undefined,
      handoverDate: date,
    }).returning();
    return row;
  }

  async confirm(id: string, sellerId: string, confirmedById: string, body: { confirmedAmount: number; ownerNote?: string }) {
    const existing = await db.query.staffHandovers.findFirst({
      where: and(eq(staffHandovers.id, id), eq(staffHandovers.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Handover not found', 404);
    if (existing.status === 'CONFIRMED') throw new AppError('Already confirmed', 400);
    if (body.confirmedAmount < 0) throw new AppError('Confirmed amount cannot be negative', 400);

    const [row] = await db.update(staffHandovers)
      .set({
        confirmedAmount: String(body.confirmedAmount),
        ownerNote: body.ownerNote?.trim() || undefined,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedById,
      })
      .where(eq(staffHandovers.id, id))
      .returning();
    return row;
  }

  async dispute(id: string, sellerId: string, ownerNote?: string) {
    const existing = await db.query.staffHandovers.findFirst({
      where: and(eq(staffHandovers.id, id), eq(staffHandovers.sellerId, sellerId)),
    });
    if (!existing) throw new AppError('Handover not found', 404);
    const [row] = await db.update(staffHandovers)
      .set({ status: 'DISPUTED', ownerNote: ownerNote?.trim() || undefined })
      .where(eq(staffHandovers.id, id))
      .returning();
    return row;
  }
}
