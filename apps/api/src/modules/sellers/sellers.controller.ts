import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { SellersService } from './sellers.service.js';
import { success } from '../../utils/response.js';
import { AppError } from '../../middleware/error.js';
import { uploadToCloudinary } from '../../utils/cloudinary.js';

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

export async function uploadLogo(req: AuthRequest, res: Response, next: (e: unknown) => void) {
  try {
    if (!req.file) throw new AppError('No file provided', 400);
    const url = await uploadToCloudinary(req.file.buffer, 'assaan/logos');
    success(res, await svc.setLogo(req.user!.sellerId!, url));
  } catch (e) { next(e); }
}

export async function deleteLogo(req: AuthRequest, res: Response) {
  success(res, await svc.removeLogo(req.user!.sellerId!));
}

export async function listPaymentAccounts(req: AuthRequest, res: Response) {
  success(res, await svc.listPaymentAccounts(req.user!.sellerId!));
}

export async function addPaymentAccount(req: AuthRequest, res: Response) {
  success(res, await svc.addPaymentAccount(req.user!.sellerId!, req.body), 201);
}

export async function removePaymentAccount(req: AuthRequest, res: Response) {
  success(res, await svc.removePaymentAccount(req.params['id']!, req.user!.sellerId!));
}
