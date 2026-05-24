import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import { users, sellers, DEFAULT_STAFF_PERMISSIONS, type StaffPermissions } from '../../db/schema.js';
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
        createdAt: users.createdAt,
      });

    return staff;
  }

  async updatePermissions(id: string, sellerId: string, permissions: Partial<StaffPermissions>) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
    });
    if (!member) throw new AppError('Staff member not found', 404);

    const merged: StaffPermissions = { ...(member.permissions ?? DEFAULT_STAFF_PERMISSIONS), ...permissions };

    const [updated] = await db
      .update(users)
      .set({ permissions: merged })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        permissions: users.permissions,
        createdAt: users.createdAt,
      });

    return updated;
  }

  async remove(id: string, sellerId: string) {
    const member = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
    });
    if (!member) throw new AppError('Staff member not found', 404);
    await db.delete(users).where(eq(users.id, id));
  }
}
