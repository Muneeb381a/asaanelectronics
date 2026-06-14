import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { sellers, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { hashPassword } from '../../utils/hash.js';

export class OwnerService {
  async listShops() {
    const rows = await db
      .select({
        id: sellers.id,
        shopName: sellers.shopName,
        phone: sellers.phone,
        address: sellers.address,
        plan: sellers.plan,
        isActive: sellers.isActive,
        trialEndsAt: sellers.trialEndsAt,
        planExpiresAt: sellers.planExpiresAt,
        createdAt: sellers.createdAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerId: users.id,
      })
      .from(sellers)
      .leftJoin(users, and(eq(users.sellerId, sellers.id), eq(users.role, 'SELLER_OWNER')));

    return rows;
  }

  async toggleShopStatus(id: string, isActive: boolean) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);
    const [updated] = await db.update(sellers).set({ isActive }).where(eq(sellers.id, id)).returning();
    return updated;
  }

  async createShop(body: { shopName: string; phone: string; address?: string; plan?: 'TRIAL' | 'BASIC' | 'PRO' }) {
    const [seller] = await db
      .insert(sellers)
      .values({
        shopName: body.shopName,
        phone: body.phone,
        address: body.address,
        plan: body.plan ?? 'TRIAL',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();
    return seller;
  }

  async createShopOwner(sellerId: string, body: { name: string; email: string; password: string }) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email), columns: { id: true } });
    if (existing) throw new AppError('Email already registered', 409);

    const password = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({ name: body.name, email: body.email, password, role: 'SELLER_OWNER', sellerId })
      .returning();

    return { id: user!.id, name: user!.name, email: user!.email, sellerId: user!.sellerId };
  }

  async deleteShop(id: string) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const hasUsers = await db.query.users.findFirst({
      where: eq(users.sellerId, id),
      columns: { id: true },
    });
    if (hasUsers) throw new AppError('Cannot delete a shop that has users. Remove the owner first.', 409);

    await db.delete(sellers).where(eq(sellers.id, id));
  }
}
