import type { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import type { AuthRequest } from './auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { StaffPermissions } from '../db/schema.js';
import { AppError } from './error.js';

export function requirePermission(perm: keyof StaffPermissions) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const user = req.user!;
    if (user.role === 'SELLER_OWNER' || user.role === 'SUPER_ADMIN') return next();
    try {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, user.userId),
        columns: { permissions: true },
      });
      if (!dbUser?.permissions?.[perm]) return next(new AppError('Permission denied', 403));
      next();
    } catch (e) {
      next(e);
    }
  };
}
