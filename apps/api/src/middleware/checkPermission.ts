import type { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import type { AuthRequest } from './auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { StaffPermissions } from '../db/schema.js';
import { AppError } from './error.js';

// Pass a single perm or an array — array means OR (any one is enough)
export function requirePermission(perm: keyof StaffPermissions | (keyof StaffPermissions)[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const user = req.user!;
    if (user.role === 'SELLER_OWNER' || user.role === 'SUPER_ADMIN') return next();
    try {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, user.userId),
        columns: { permissions: true },
      });
      const perms = dbUser?.permissions;
      const allowed = Array.isArray(perm)
        ? perm.some((p) => perms?.[p])
        : perms?.[perm];
      if (!allowed) return next(new AppError('Permission denied', 403));
      next();
    } catch (e) {
      next(e);
    }
  };
}
