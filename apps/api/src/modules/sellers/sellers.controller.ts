import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { SellersService } from './sellers.service.js';
import { success } from '../../utils/response.js';

const svc = new SellersService();

export async function createSeller(req: AuthRequest, res: Response) {
  const data = await svc.create(req.user!.userId, req.body as { shopName: string; phone: string; address?: string });
  success(res, data, 201);
}

export async function getMyShop(req: AuthRequest, res: Response) {
  success(res, await svc.getMe(req.user!.sellerId!));
}

export async function updateMyShop(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.user!.sellerId!, req.body));
}
