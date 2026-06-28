import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ProductUnitsService } from './productUnits.service.js';
import { success } from '../../utils/response.js';
import type { CreateProductUnitInput, BulkCreateProductUnitsInput, UpdateProductUnitInput } from '@assaan/shared';

const svc = new ProductUnitsService();

export async function listUnits(req: AuthRequest, res: Response) {
  const page   = Math.max(1, Number(req.query['page'])  || 1);
  const limit  = Math.min(Math.max(1, Number(req.query['limit']) || 30), 100);
  const search    = req.query['search']    as string | undefined;
  const status    = req.query['status']    as string | undefined;
  const productId = req.query['productId'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, { search, status, productId, page, limit }));
}

export async function getUnitStats(req: AuthRequest, res: Response) {
  success(res, await svc.getStats(req.user!.sellerId!));
}

export async function lookupImei(req: AuthRequest, res: Response) {
  const imei = (req.params['imei'] ?? '').replace(/\s/g, '');
  success(res, await svc.lookupImei(imei, req.user!.sellerId!));
}

export async function ptaCheck(req: AuthRequest, res: Response) {
  const imei = (req.params['imei'] ?? '').replace(/\D/g, '');
  success(res, await svc.checkPta(imei));
}

export async function createUnit(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.body as CreateProductUnitInput), 201);
}

export async function bulkCreateUnits(req: AuthRequest, res: Response) {
  success(res, await svc.bulkCreate(req.user!.sellerId!, req.body as BulkCreateProductUnitsInput), 201);
}

export async function updateUnit(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.params['id']!, req.user!.sellerId!, req.body as UpdateProductUnitInput));
}

export async function removeUnit(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, { deleted: true });
}
