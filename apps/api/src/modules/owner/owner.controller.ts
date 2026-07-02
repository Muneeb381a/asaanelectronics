import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { OwnerService } from './owner.service.js';
import { success } from '../../utils/response.js';

const svc = new OwnerService();

export async function listShops(_req: Request, res: Response) {
  success(res, await svc.listShops());
}

export async function createShop(req: Request, res: Response) {
  success(res, await svc.createShop(req.body), 201);
}

export async function createShopOwner(req: Request, res: Response) {
  success(res, await svc.createShopOwner(req.params['id'] as string, req.body), 201);
}

export async function deleteShop(req: Request, res: Response) {
  await svc.deleteShop(req.params['id'] as string);
  success(res, null);
}

export async function toggleShopStatus(req: Request, res: Response) {
  const { isActive } = req.body as { isActive: boolean };
  success(res, await svc.toggleShopStatus(req.params['id'] as string, isActive));
}

// ── A1: Platform stats ────────────────────────────────────────────────────────
export async function getPlatformStats(_req: Request, res: Response) {
  success(res, await svc.getPlatformStats());
}

// ── A3: Shop usage drill-in ───────────────────────────────────────────────────
export async function getShopUsage(req: Request, res: Response) {
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
  success(res, await svc.deletePaymentLog(req.params['logId'] as string));
}

// ── A7: Shop notes ────────────────────────────────────────────────────────────
export async function addShopNote(req: AuthRequest, res: Response) {
  const sellerId = req.params['id'] as string;
  const row = await svc.addShopNote(sellerId, req.user!.userId, req.body?.content);
  success(res, row, 201);
}

export async function deleteShopNote(req: AuthRequest, res: Response) {
  success(res, await svc.deleteShopNote(req.params['noteId'] as string));
}
