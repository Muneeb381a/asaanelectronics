import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { refreshTokens } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

export class SessionsService {
  async list(userId: string) {
    const now = new Date();
    return db
      .select({
        id:           refreshTokens.id,
        deviceName:   refreshTokens.deviceName,
        deviceType:   refreshTokens.deviceType,
        ip:           refreshTokens.ip,
        lastActiveAt: refreshTokens.lastActiveAt,
        createdAt:    refreshTokens.createdAt,
        expiresAt:    refreshTokens.expiresAt,
        isSuspicious: refreshTokens.isSuspicious,
      })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, userId), gt(refreshTokens.expiresAt, now)))
      .orderBy(desc(refreshTokens.lastActiveAt));
  }

  async revoke(id: string, userId: string) {
    const session = await db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.id, id), eq(refreshTokens.userId, userId)),
    });
    if (!session) throw new AppError('Session not found', 404);
    await db.delete(refreshTokens).where(eq(refreshTokens.id, id));
  }

  async revokeAll(userId: string, exceptId?: string) {
    const cond = exceptId
      ? and(eq(refreshTokens.userId, userId), ne(refreshTokens.id, exceptId))
      : eq(refreshTokens.userId, userId);
    await db.delete(refreshTokens).where(cond);
  }
}
