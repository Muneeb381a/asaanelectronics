import type { Request, Response } from 'express';
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
