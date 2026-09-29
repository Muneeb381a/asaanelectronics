import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { success } from '../../utils/response.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import type { StaffPermissions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { AssistantService } from './assistant.service.js';

const svc = new AssistantService();

export async function ask(req: AuthRequest, res: Response) {
  const message = (req.body as { message?: string }).message?.trim();
  if (!message || message.length > 300) throw new AppError('Message required (max 300 characters).', 400);

  const user = req.user!;
  const staffUserId = user.role === 'SELLER_STAFF' ? user.userId : undefined;

  let canViewReports = user.role === 'SELLER_OWNER' || user.role === 'SUPER_ADMIN';
  if (!canViewReports && user.role === 'SELLER_STAFF') {
    const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.userId), columns: { permissions: true } });
    canViewReports = !!(dbUser?.permissions as StaffPermissions | null)?.canViewReports;
  }

  const result = await svc.ask({ sellerId: user.sellerId!, staffUserId, canViewReports }, message);
  success(res, result);
}
