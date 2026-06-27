import { eq, and, sql, gte, lt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import { users, sellers, refreshTokens, payments, customers, installments, DEFAULT_STAFF_PERMISSIONS, type StaffPermissions } from '../../db/schema.js';
export type { StaffPermissions };
import { AppError } from '../../middleware/error.js';
import { PLAN_LIMITS, isUnlimited } from '../../config/plans.js';

export class StaffService {
  async list(sellerId: string) {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        permissions: users.permissions,
        frozenUntil: users.frozenUntil,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));
  }

  async create(sellerId: string, body: { name: string; email: string; password: string; permissions?: StaffPermissions }) {
    // Plan limit check
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
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        permissions: users.permissions,
        frozenUntil: users.frozenUntil,
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
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        permissions: users.permissions,
        frozenUntil: users.frozenUntil,
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
        frozenUntil: users.frozenUntil, createdAt: users.createdAt,
      });

    if (!updated) throw new AppError('Staff member not found', 404);

    // Revoke all active refresh tokens so they can't silently stay logged in
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
        frozenUntil: users.frozenUntil, createdAt: users.createdAt,
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

  async commissions(sellerId: string, month?: string) {
    const seller = await db.query.sellers.findFirst({
      where: eq(sellers.id, sellerId),
      columns: { settings: true },
    });
    const rate = (seller?.settings as { commissionRate?: number } | null)?.commissionRate ?? 0;

    // Default to current month if not provided
    const ref = month ? new Date(month + '-01') : new Date();
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const to   = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);

    const rows = await db.execute<{ userId: string; userName: string; total: string; count: number }>(sql`
      SELECT
        p.collected_by                                    AS "userId",
        u.name                                            AS "userName",
        COALESCE(SUM(p.amount::numeric), 0)::text        AS total,
        COUNT(*)::int                                     AS count
      FROM payments p
      INNER JOIN users u        ON u.id = p.collected_by
      INNER JOIN installments i ON i.id = p.installment_id
      INNER JOIN customers c    ON c.id = i.customer_id
      WHERE c.seller_id = ${sellerId}
        AND p.deleted_at IS NULL
        AND p.paid_on >= ${from.toISOString()}
        AND p.paid_on <  ${to.toISOString()}
        AND p.collected_by IS NOT NULL
      GROUP BY p.collected_by, u.name
      ORDER BY total::numeric DESC
    `);

    const monthLabel = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

    return {
      month: monthLabel,
      commissionRate: rate,
      staff: rows.map((r) => ({
        userId:     r.userId,
        userName:   r.userName,
        collected:  Number(r.total),
        payments:   Number(r.count),
        commission: rate > 0 ? Math.round(Number(r.total) * (rate / 100)) : 0,
      })),
    };
  }
}
