import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { sellers, users, refreshTokens } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { signAccess, signRefresh } from '../../utils/jwt.js';

export class SellersService {
  async create(userId: string, body: { shopName: string; phone: string; address?: string }) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new AppError('User not found', 404);
    if (user.sellerId) throw new AppError('You already have a shop', 409);

    const [seller] = await db
      .insert(sellers)
      .values({
        shopName: body.shopName,
        phone: body.phone,
        address: body.address,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    if (!seller) throw new AppError('Failed to create shop', 500);

    await db
      .update(users)
      .set({ sellerId: seller.id, role: 'SELLER_OWNER' })
      .where(eq(users.id, userId));

    // Re-issue tokens so sellerId is baked into the new JWT
    const accessToken = signAccess({ userId, sellerId: seller.id, role: 'SELLER_OWNER' });
    const refreshToken = signRefresh({ userId });

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await db.insert(refreshTokens).values({
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      seller,
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: 'SELLER_OWNER', sellerId: seller.id },
    };
  }

  async update(sellerId: string, body: { shopName?: string; phone?: string; address?: string; murabahaMode?: boolean }) {
    const [updated] = await db
      .update(sellers)
      .set(body)
      .where(eq(sellers.id, sellerId))
      .returning();
    if (!updated) throw new AppError('Shop not found', 404);
    return updated;
  }

  async getMe(sellerId: string) {
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId) });
    if (!seller) throw new AppError('Shop not found', 404);
    return seller;
  }
}
