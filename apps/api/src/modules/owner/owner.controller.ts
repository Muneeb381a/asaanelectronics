import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { OwnerService } from './owner.service.js';
import { success } from '../../utils/response.js';

const svc = new OwnerService();

export async function listShops(_req: AuthRequest, res: Response) {
  success(res, await svc.listShops());
}

export async function createShop(req: AuthRequest, res: Response) {
  success(res, await svc.createShop(req.body, req.user!.userId), 201);
}

export async function createShopOwner(req: AuthRequest, res: Response) {
  success(res, await svc.createShopOwner(req.params['id'] as string, req.body, req.user!.userId), 201);
}

export async function deleteShop(req: AuthRequest, res: Response) {
  await svc.deleteShop(req.params['id'] as string, req.user!.userId);
  success(res, null);
}

export async function toggleShopStatus(req: AuthRequest, res: Response) {
  const { isActive } = req.body as { isActive: boolean };
  success(res, await svc.toggleShopStatus(req.params['id'] as string, isActive, req.user!.userId));
}

// ── A1: Platform stats ────────────────────────────────────────────────────────
export async function getPlatformStats(_req: AuthRequest, res: Response) {
  success(res, await svc.getPlatformStats());
}

// ── A3: Shop usage drill-in ───────────────────────────────────────────────────
export async function getShopUsage(req: AuthRequest, res: Response) {
  success(res, await svc.getShopUsage(req.params['id'] as string));
}

// ── A4: Manual payment logs ───────────────────────────────────────────────────
export async function listPaymentLogs(req: AuthRequest, res: Response) {
  const sellerId = req.query['sellerId'] as string | undefined;
  success(res, await svc.listPaymentLogs(sellerId));
}

export async function addPaymentLog(req: AuthRequest, res: Response) {
  const sellerId = req.params['id'] as string;
  const row = await svc.addPaymentLog(sellerId, req.user!.userId, req.body);
  success(res, row, 201);
}

export async function deletePaymentLog(req: AuthRequest, res: Response) {
  success(res, await svc.deletePaymentLog(req.params['logId'] as string, req.user!.userId));
}

// ── A7: Shop notes ────────────────────────────────────────────────────────────
export async function addShopNote(req: AuthRequest, res: Response) {
  const sellerId = req.params['id'] as string;
  const row = await svc.addShopNote(sellerId, req.user!.userId, req.body?.content);
  success(res, row, 201);
}

export async function deleteShopNote(req: AuthRequest, res: Response) {
  success(res, await svc.deleteShopNote(req.params['noteId'] as string, req.user!.userId));
}

// ── A10: Admin audit log ──────────────────────────────────────────────────────
export async function listAdminAuditLogs(req: AuthRequest, res: Response) {
  const sellerId = req.query['sellerId'] as string | undefined;
  const limit    = Math.min(200, Number(req.query['limit'] ?? 100));
  success(res, await svc.listAdminAuditLogs(sellerId, limit));
}

// ── B1: Churn Risk Score ──────────────────────────────────────────────────────
export async function listChurnScores(_req: AuthRequest, res: Response) {
  success(res, await svc.getChurnScores());
}

// ── B2: Renewal reminder email ────────────────────────────────────────────────
export async function sendRenewalReminder(req: AuthRequest, res: Response) {
  success(res, await svc.sendRenewalReminder(req.params['id'] as string, req.user!.userId));
}

// ── B4: Shops CSV export ──────────────────────────────────────────────────────
export async function exportShopsCSV(_req: AuthRequest, res: Response) {
  const csv  = await svc.exportShopsCSV();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="shops-${date}.csv"`);
  res.send(csv);
}

// ── B5: Shop onboarding checklist ────────────────────────────────────────────
export async function getOnboardingStatus(_req: AuthRequest, res: Response) {
  success(res, await svc.getOnboardingStatus());
}

// ── B3: Broadcast announcements ───────────────────────────────────────────────
export async function listBroadcasts(_req: AuthRequest, res: Response) {
  success(res, await svc.listBroadcasts());
}

export async function createBroadcast(req: AuthRequest, res: Response) {
  success(res, await svc.createBroadcast(req.body, req.user!.userId), 201);
}

export async function updateBroadcast(req: AuthRequest, res: Response) {
  success(res, await svc.updateBroadcast(req.params['id'] as string, req.body, req.user!.userId));
}

export async function deleteBroadcast(req: AuthRequest, res: Response) {
  await svc.deleteBroadcast(req.params['id'] as string, req.user!.userId);
  success(res, null);
}

// ── Session management ────────────────────────────────────────────────────────
export async function getShopSessions(req: AuthRequest, res: Response) {
  success(res, await svc.getShopSessions(req.params['id'] as string));
}

export async function killSession(req: AuthRequest, res: Response) {
  await svc.killSession(
    req.params['sessionId'] as string,
    req.user!.userId,
    req.user!.sessionId,
  );
  success(res, { killed: true });
}

export async function killAllShopSessions(req: AuthRequest, res: Response) {
  const result = await svc.killAllShopSessions(
    req.params['id'] as string,
    req.user!.userId,
    req.user!.sessionId,
  );
  success(res, result);
}
