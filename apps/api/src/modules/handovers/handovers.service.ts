import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { staffHandovers } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

export interface StaffBalanceRow {
  staffId: string;
  staffName: string;
  staffEmail: string;
  totalCollected: string;
  totalConfirmed: string;
  pendingBalance: string;
  pendingHandover: {
    id: string;
    handedAmount: string;
    createdAt: string;
    note: string | null;
  } | null;
}

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

  // Returns the cumulative unconfirmed cash balance for one or all staff members.
  // pendingBalance = total CASH collected (all time) − total CONFIRMED handover amounts.
  async pendingBalances(sellerId: string, staffId?: string): Promise<StaffBalanceRow[]> {
    const staffFilter = staffId ? sql`AND u.id = ${staffId}` : sql``;

    const rows = await db.execute<Record<string, unknown>>(sql`
      SELECT
        u.id AS "staffId",
        u.name AS "staffName",
        u.email AS "staffEmail",
        (
          COALESCE((
            SELECT SUM(p.amount)
            FROM payments p
            JOIN installments i ON i.id = p.installment_id
            WHERE p.collected_by = u.id
              AND i.seller_id = ${sellerId}
              AND p.deleted_at IS NULL
              AND p.method = 'CASH'
          ), 0)
          +
          COALESCE((
            SELECT SUM(cs.amount)
            FROM cash_sales cs
            WHERE cs.sold_by_user_id = u.id
              AND cs.seller_id = ${sellerId}
              AND cs.method = 'CASH'
          ), 0)
        ) AS "totalCollected",
        COALESCE((
          SELECT SUM(h.confirmed_amount)
          FROM staff_handovers h
          WHERE h.staff_id = u.id
            AND h.seller_id = ${sellerId}
            AND h.status = 'CONFIRMED'
        ), 0) AS "totalConfirmed",
        (
          COALESCE((
            SELECT SUM(p.amount)
            FROM payments p
            JOIN installments i ON i.id = p.installment_id
            WHERE p.collected_by = u.id
              AND i.seller_id = ${sellerId}
              AND p.deleted_at IS NULL
              AND p.method = 'CASH'
          ), 0)
          +
          COALESCE((
            SELECT SUM(cs.amount)
            FROM cash_sales cs
            WHERE cs.sold_by_user_id = u.id
              AND cs.seller_id = ${sellerId}
              AND cs.method = 'CASH'
          ), 0)
          -
          COALESCE((
            SELECT SUM(h.confirmed_amount)
            FROM staff_handovers h
            WHERE h.staff_id = u.id
              AND h.seller_id = ${sellerId}
              AND h.status = 'CONFIRMED'
          ), 0)
        ) AS "pendingBalance",
        (
          SELECT json_build_object(
            'id',           ph.id,
            'handedAmount', ph.handed_amount::text,
            'createdAt',    ph.created_at,
            'note',         ph.note
          )
          FROM staff_handovers ph
          WHERE ph.staff_id = u.id
            AND ph.seller_id = ${sellerId}
            AND ph.status = 'PENDING'
          ORDER BY ph.created_at DESC
          LIMIT 1
        ) AS "pendingHandover"
      FROM users u
      WHERE u.seller_id = ${sellerId}
        AND u.role = 'SELLER_STAFF'
        AND u.is_active = TRUE
        ${staffFilter}
      ORDER BY "pendingBalance" DESC
    `);
    return rows as unknown as StaffBalanceRow[];
  }

  async create(sellerId: string, staffId: string, body: { handedAmount: number; note?: string; handoverDate?: string }) {
    if (!body.handedAmount || body.handedAmount <= 0)
      throw new AppError('Amount must be greater than 0', 400);

    // Validate date: not in future, not older than 30 days
    const date = body.handoverDate ? new Date(body.handoverDate) : new Date();
    const now  = new Date();
    if (date > now)
      throw new AppError('Handover date cannot be in the future', 400);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (date < thirtyDaysAgo)
      throw new AppError('Handover date cannot be older than 30 days', 400);

    // Block duplicate: only one PENDING handover allowed per staff at a time
    const existing = await db.query.staffHandovers.findFirst({
      where: and(
        eq(staffHandovers.staffId, staffId),
        eq(staffHandovers.sellerId, sellerId),
        eq(staffHandovers.status, 'PENDING'),
      ),
    });
    if (existing)
      throw new AppError('You already have a pending handover awaiting owner confirmation. Wait for it to be reviewed before submitting another.', 400);

    const [row] = await db.insert(staffHandovers).values({
      sellerId,
      staffId,
      handedAmount:  String(body.handedAmount),
      note:          body.note?.trim() || undefined,
      handoverDate:  date,
    }).returning();
    return row!;
  }

  async confirm(id: string, sellerId: string, confirmedById: string, body: { confirmedAmount: number; ownerNote?: string }) {
    const existing = await db.query.staffHandovers.findFirst({
      where: and(eq(staffHandovers.id, id), eq(staffHandovers.sellerId, sellerId)),
    });
    if (!existing)                            throw new AppError('Handover not found', 404);
    if (existing.status === 'CONFIRMED')      throw new AppError('Already confirmed', 400);
    if (body.confirmedAmount < 0)             throw new AppError('Confirmed amount cannot be negative', 400);

    const [row] = await db.update(staffHandovers)
      .set({
        confirmedAmount: String(body.confirmedAmount),
        ownerNote:       body.ownerNote?.trim() || undefined,
        status:          'CONFIRMED',
        confirmedAt:     new Date(),
        confirmedById,
      })
      .where(eq(staffHandovers.id, id))
      .returning();
    return row!;
  }

  async dispute(id: string, sellerId: string, ownerNote?: string) {
    const existing = await db.query.staffHandovers.findFirst({
      where: and(eq(staffHandovers.id, id), eq(staffHandovers.sellerId, sellerId)),
    });
    if (!existing)                        throw new AppError('Handover not found', 404);
    if (existing.status === 'CONFIRMED')  throw new AppError('Cannot dispute a confirmed handover', 400);
    if (existing.status === 'DISPUTED')   throw new AppError('Already disputed', 400);

    const [row] = await db.update(staffHandovers)
      .set({ status: 'DISPUTED', ownerNote: ownerNote?.trim() || undefined })
      .where(eq(staffHandovers.id, id))
      .returning();
    return row!;
  }

  // Owner directly receives cash from a staff member without waiting for staff
  // to submit first. If there is already a PENDING handover for this staff,
  // that one is confirmed (no duplicate). If not, a new CONFIRMED record is
  // created immediately — staff's balance clears on the same request.
  async directReceive(
    sellerId: string,
    ownerId: string,
    body: { staffId: string; amount: number; note?: string },
  ) {
    if (!body.amount || body.amount <= 0)
      throw new AppError('Amount must be greater than 0', 400);

    // Consume any existing PENDING handover rather than creating a duplicate
    const pending = await db.query.staffHandovers.findFirst({
      where: and(
        eq(staffHandovers.staffId, body.staffId),
        eq(staffHandovers.sellerId, sellerId),
        eq(staffHandovers.status, 'PENDING'),
      ),
    });

    if (pending) {
      const [row] = await db
        .update(staffHandovers)
        .set({
          confirmedAmount: String(body.amount),
          ownerNote:       body.note?.trim() || undefined,
          status:          'CONFIRMED',
          confirmedAt:     new Date(),
          confirmedById:   ownerId,
        })
        .where(eq(staffHandovers.id, pending.id))
        .returning();
      return row!;
    }

    const [row] = await db
      .insert(staffHandovers)
      .values({
        sellerId,
        staffId:         body.staffId,
        handedAmount:    String(body.amount),
        confirmedAmount: String(body.amount),
        status:          'CONFIRMED',
        confirmedAt:     new Date(),
        confirmedById:   ownerId,
        note:            body.note?.trim() || undefined,
        handoverDate:    new Date(),
      })
      .returning();
    return row!;
  }

  // Reopen a DISPUTED handover back to PENDING so the staff can resubmit or
  // the owner reconsiders. Only DISPUTED → PENDING is allowed.
  async reopen(id: string, sellerId: string) {
    const existing = await db.query.staffHandovers.findFirst({
      where: and(eq(staffHandovers.id, id), eq(staffHandovers.sellerId, sellerId)),
    });
    if (!existing)                       throw new AppError('Handover not found', 404);
    if (existing.status !== 'DISPUTED')  throw new AppError('Only disputed handovers can be reopened', 400);

    // Before reopening: ensure staff doesn't already have another PENDING
    const otherPending = await db.query.staffHandovers.findFirst({
      where: and(
        eq(staffHandovers.staffId, existing.staffId),
        eq(staffHandovers.sellerId, sellerId),
        eq(staffHandovers.status, 'PENDING'),
      ),
    });
    if (otherPending)
      throw new AppError('Staff already has another pending handover. Resolve that first.', 400);

    const [row] = await db.update(staffHandovers)
      .set({ status: 'PENDING' })
      .where(eq(staffHandovers.id, id))
      .returning();
    return row!;
  }
}
