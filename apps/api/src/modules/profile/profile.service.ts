import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';

export class ProfileService {
  async getMe(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true, role: true, sellerId: true, permissions: true, createdAt: true },
    });
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async update(userId: string, body: { name?: string; email?: string }) {
    if (body.email) {
      const clash = await db.query.users.findFirst({
        where: eq(users.email, body.email),
        columns: { id: true },
      });
      if (clash && clash.id !== userId) throw new AppError('Email already in use', 409);
    }

    const [updated] = await db
      .update(users)
      .set({ ...(body.name && { name: body.name }), ...(body.email && { email: body.email }) })
      .where(eq(users.id, userId))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role, sellerId: users.sellerId });

    return updated;
  }

  async changePassword(userId: string, body: { currentPassword: string; newPassword: string }) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new AppError('User not found', 404);

    const valid = await comparePassword(body.currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect', 400);

    const hashed = await hashPassword(body.newPassword);
    await db.update(users).set({ password: hashed }).where(eq(users.id, userId));
  }
}
