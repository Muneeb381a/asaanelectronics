import { eq, and, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import {
  users, sellers, refreshTokens, payments, customers, installments,
  commissionPayments, salaryPayments,
  DEFAULT_STAFF_PERMISSIONS, type StaffPermissions,
} from '../../db/schema.js';
export type { StaffPermissions };
import { AppError } from '../../middleware/error.js';
import { PLAN_LIMITS, isUnlimited } from '../../config/plans.js';

export class StaffService {
  async list(sellerId: string) {
    return db
      .select({
        id:             users.id,
        name:           users.name,
        email:          users.email,
        role:           users.role,
        permissions:    users.permissions,
        frozenUntil:    users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary:  users.monthlySalary,
        createdAt:      users.createdAt,
      })
      .from(users)
      .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));
  }

  async create(sellerId: string, body: { name: string; email: string; password: string; permissions?: StaffPermissions }) {
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { plan: true } });
    const limit = PLAN_LIMITS[seller?.plan ?? 'TRIAL'].staff;
    if (!isUnlimited(limit)) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
        .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));
      if (count >= limit) throw new AppError(`Staff limit reached (${limit} on ${seller?.plan ?? 'TRIAL'} plan). Please upgrade.`, 402);
    }

    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) throw new AppError('Email already in use', 409);

    const hash = await bcrypt.hash(body.password, 10);
    const [staff] = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        password: hash,
        role: 'SELLER_STAFF',
        sellerId,
        permissions: body.permissions ?? DEFAULT_STAFF_PERMISSIONS,
      })
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    return staff;
  }

  async updatePermissions(id: string, sellerId: string, permissions: Partial<StaffPermissions>) {
    const [updated] = await db
      .update(users)
      .set({
        permissions: sql`(COALESCE(${users.permissions}::jsonb, '{}'::jsonb) || ${JSON.stringify(permissions)}::jsonb)::json`,
      })
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    return updated;
  }

  async updateProfile(id: string, sellerId: string, body: { commissionRate?: number | null; monthlySalary?: number | null }) {
    const set: Record<string, unknown> = {};
    if (body.commissionRate !== undefined) set['commissionRate'] = body.commissionRate;
    if (body.monthlySalary  !== undefined) set['monthlySalary']  = body.monthlySalary;

    const [updated] = await db
      .update(users)
      .set(set)
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    return updated;
  }

  async remove(id: string, sellerId: string) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
    });
    if (!member) throw new AppError('Staff member not found', 404);
    await db.delete(users).where(eq(users.id, id));
  }

  async freeze(id: string, sellerId: string, durationMonths: number | 'permanent') {
    const frozenUntil = durationMonths === 'permanent'
      ? new Date('2099-12-31T23:59:59Z')
      : new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(users)
      .set({ frozenUntil })
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));
    return updated;
  }

  async unfreeze(id: string, sellerId: string) {
    const [updated] = await db
      .update(users)
      .set({ frozenUntil: null })
      .where(and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')))
      .returning({
        id: users.id, name: users.name, email: users.email,
        role: users.role, permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        commissionRate: users.commissionRate,
        monthlySalary: users.monthlySalary,
        createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);
    return updated;
  }

  async getOne(id: string, sellerId: string) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { id: true, name: true, email: true, role: true, permissions: true, frozenUntil: true },
    });
    if (!member) throw new AppError('Staff member not found', 404);
    return member;
  }

  async getPermissions(id: string, sellerId: string) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { permissions: true },
    });
    return member?.permissions ?? DEFAULT_STAFF_PERMISSIONS;
  }

  // ── Commission ────────────────────────────────────────────────────────────────

  async commissions(sellerId: string, month?: string) {
    const seller = await db.query.sellers.findFirst({
      where: eq(sellers.id, sellerId),
      columns: { settings: true },
    });
    const shopRate = (seller?.settings as { commissionRate?: number } | null)?.commissionRate ?? 0;

    const ref  = month ? new Date(month + '-01') : new Date();
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const to   = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const monthLabel = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

    // Fetch collections grouped by staff
    const rows = await db.execute<{ userId: string; userName: string; total: string; count: number; perStaffRate: string | null }>(sql`
      SELECT
        p.collected_by                                          AS "userId",
        u.name                                                  AS "userName",
        COALESCE(SUM(p.amount::numeric), 0)::text               AS total,
        COUNT(*)::int                                           AS count,
        u.commission_rate::text                                 AS "perStaffRate"
      FROM payments p
      INNER JOIN users u        ON u.id = p.collected_by
      INNER JOIN installments i ON i.id = p.installment_id
      INNER JOIN customers c    ON c.id = i.customer_id
      WHERE c.seller_id = ${sellerId}
        AND p.deleted_at IS NULL
        AND p.paid_on >= ${from.toISOString()}
        AND p.paid_on <  ${to.toISOString()}
        AND p.collected_by IS NOT NULL
      GROUP BY p.collected_by, u.name, u.commission_rate
      ORDER BY total::numeric DESC
    `);

    // Fetch which staff already had commission paid this month
    const staffIds = rows.map((r) => r.userId);
    const paid = staffIds.length
      ? await db.select().from(commissionPayments)
          .where(and(
            eq(commissionPayments.sellerId, sellerId),
            eq(commissionPayments.month, monthLabel),
            inArray(commissionPayments.staffId, staffIds),
          ))
      : [];

    const paidMap = new Map(paid.map((p) => [p.staffId, p]));

    return {
      month: monthLabel,
      commissionRate: shopRate,
      staff: rows.map((r) => {
        const effectiveRate = r.perStaffRate !== null ? Number(r.perStaffRate) : shopRate;
        const collected     = Number(r.total);
        const commission    = effectiveRate > 0 ? Math.round(collected * (effectiveRate / 100)) : 0;
        const paidRecord    = paidMap.get(r.userId) ?? null;
        return {
          userId:         r.userId,
          userName:       r.userName,
          collected,
          payments:       Number(r.count),
          commissionRate: effectiveRate,
          commission,
          paid:           paidRecord ? {
            id:     paidRecord.id,
            amount: Number(paidRecord.amount),
            paidAt: paidRecord.paidAt,
            note:   paidRecord.note,
          } : null,
        };
      }),
    };
  }

  async payCommission(sellerId: string, paidById: string, body: { staffId: string; month: string; amount: number; note?: string }) {
    // Verify staff belongs to this seller
    const staff = await db.query.users.findFirst({
      where: and(eq(users.id, body.staffId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { id: true, name: true },
    });
    if (!staff) throw new AppError('Staff not found', 404);

    const { randomUUID } = await import('crypto');
    const [record] = await db
      .insert(commissionPayments)
      .values({
        id:       randomUUID(),
        sellerId,
        staffId:  body.staffId,
        month:    body.month,
        amount:   String(body.amount),
        paidById,
        note:     body.note ?? null,
      })
      .onConflictDoUpdate({
        target: [commissionPayments.sellerId, commissionPayments.staffId, commissionPayments.month],
        set: {
          amount:  String(body.amount),
          paidById,
          note:    body.note ?? null,
          paidAt:  new Date(),
        },
      })
      .returning();

    return record;
  }

  async deleteCommissionPayment(sellerId: string, staffId: string, month: string) {
    const [deleted] = await db
      .delete(commissionPayments)
      .where(and(
        eq(commissionPayments.sellerId, sellerId),
        eq(commissionPayments.staffId, staffId),
        eq(commissionPayments.month, month),
      ))
      .returning();
    if (!deleted) throw new AppError('Commission payment not found', 404);
    return deleted;
  }

  // ── Salary ────────────────────────────────────────────────────────────────────

  async listSalaries(sellerId: string, month?: string) {
    const ref  = month ? new Date(month + '-01') : new Date();
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const monthLabel = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

    const staffList = await this.list(sellerId);

    const paid = staffList.length
      ? await db.select().from(salaryPayments)
          .where(and(
            eq(salaryPayments.sellerId, sellerId),
            eq(salaryPayments.month, monthLabel),
            inArray(salaryPayments.staffId, staffList.map((s) => s.id)),
          ))
      : [];

    const paidMap = new Map(paid.map((p) => [p.staffId, p]));

    return {
      month: monthLabel,
      staff: staffList.map((s) => {
        const paidRecord = paidMap.get(s.id) ?? null;
        return {
          id:            s.id,
          name:          s.name,
          email:         s.email,
          monthlySalary: s.monthlySalary ? Number(s.monthlySalary) : null,
          paid:          paidRecord ? {
            id:     paidRecord.id,
            amount: Number(paidRecord.amount),
            paidAt: paidRecord.paidAt,
            note:   paidRecord.note,
          } : null,
        };
      }),
    };
  }

  async paySalary(sellerId: string, paidById: string, body: { staffId: string; month: string; amount: number; note?: string }) {
    const staff = await db.query.users.findFirst({
      where: and(eq(users.id, body.staffId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
      columns: { id: true, name: true },
    });
    if (!staff) throw new AppError('Staff not found', 404);

    const { randomUUID } = await import('crypto');
    const [record] = await db
      .insert(salaryPayments)
      .values({
        id:       randomUUID(),
        sellerId,
        staffId:  body.staffId,
        month:    body.month,
        amount:   String(body.amount),
        paidById,
        note:     body.note ?? null,
      })
      .onConflictDoUpdate({
        target: [salaryPayments.sellerId, salaryPayments.staffId, salaryPayments.month],
        set: {
          amount:  String(body.amount),
          paidById,
          note:    body.note ?? null,
          paidAt:  new Date(),
        },
      })
      .returning();

    return record;
  }

  async deleteSalaryPayment(sellerId: string, staffId: string, month: string) {
    const [deleted] = await db
      .delete(salaryPayments)
      .where(and(
        eq(salaryPayments.sellerId, sellerId),
        eq(salaryPayments.staffId, staffId),
        eq(salaryPayments.month, month),
      ))
      .returning();
    if (!deleted) throw new AppError('Salary payment not found', 404);
    return deleted;
  }
}
