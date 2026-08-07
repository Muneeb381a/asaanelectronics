import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { VehicleStockService } from './vehicleStock.service.js';
import { success } from '../../utils/response.js';

const svc = new VehicleStockService();

export async function listVehicleStock(req: AuthRequest, res: Response) {
  const page  = Math.max(1, Number(req.query['page'])  || 1);
  const limit = Math.min(Math.max(1, Number(req.query['limit']) || 20), 200);
  const status      = req.query['status']      as string | undefined;
  const vehicleType = req.query['vehicleType'] as string | undefined;
  const search      = req.query['search']      as string | undefined;
  const condition   = req.query['condition']   as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, page, limit, status, vehicleType, search, condition));
}

export async function getVehicleStockStats(req: AuthRequest, res: Response) {
  success(res, await svc.stats(req.user!.sellerId!));
}

export async function getVehicleStock(req: AuthRequest, res: Response) {
  success(res, await svc.getOne(req.params['id']!, req.user!.sellerId!));
}

export async function createVehicleStock(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.body), 201);
}

export async function updateVehicleStock(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.params['id']!, req.user!.sellerId!, req.body));
}

export async function deleteVehicleStock(req: AuthRequest, res: Response) {
  await svc.delete(req.params['id']!, req.user!.sellerId!, req.user!.userId!);
  success(res, { deleted: true });
}
