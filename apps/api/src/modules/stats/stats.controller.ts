import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { StatsService } from './stats.service.js';
import { success } from '../../utils/response.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import type { StaffPermissions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const svc = new StatsService();

export async function getStats(req: AuthRequest, res: Response) {
  const user = req.user!;
  const staffUserId = user.role === 'SELLER_STAFF' ? user.userId : undefined;
  success(res, await svc.getStats(user.sellerId!, staffUserId));
}

export async function getReports(req: AuthRequest, res: Response) {
  success(res, await svc.getReports(req.user!.sellerId!));
}

export async function getAdvanced(req: AuthRequest, res: Response) {
  success(res, await svc.getAdvanced(req.user!.sellerId!));
}

export async function getDailyBriefing(req: AuthRequest, res: Response) {
  success(res, await svc.getDailyBriefing(req.user!.sellerId!));
}

export async function getStaffTodayCollections(req: AuthRequest, res: Response) {
  success(res, await svc.getStaffTodayCollections(req.user!.sellerId!));
}

export async function getDashboard(req: AuthRequest, res: Response) {
  const user = req.user!;
  const sellerId = user.sellerId!;
  const staffUserId = user.role === 'SELLER_STAFF' ? user.userId : undefined;

  let canReports = user.role === 'SELLER_OWNER' || user.role === 'SUPER_ADMIN';
  if (!canReports && user.role === 'SELLER_STAFF') {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { permissions: true },
    });
    canReports = !!(dbUser?.permissions as StaffPermissions | null)?.canViewReports;
  }

  const settle = <T>(p: Promise<T>) =>
    p.then((v) => ({ ok: true as const, value: v }))
     .catch((e: Error) => { console.error('[dashboard]', e.message); return { ok: false as const, value: null }; });

  const [statsR, reportsR, advancedR] = await Promise.all([
    settle(svc.getStats(sellerId, staffUserId)),
    canReports ? settle(svc.getReports(sellerId)) : Promise.resolve({ ok: true as const, value: null }),
    canReports ? settle(svc.getAdvanced(sellerId)) : Promise.resolve({ ok: true as const, value: null }),
  ]);

  success(res, {
    stats:    statsR.value,
    reports:  reportsR.value,
    advanced: advancedR.value,
  });
}
