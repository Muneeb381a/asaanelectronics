import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { VehicleInstallmentsService } from './vehicleInstallments.service.js';
import { success } from '../../utils/response.js';

const svc = new VehicleInstallmentsService();

export async function listVehicleInstallments(req: AuthRequest, res: Response) {
  const page  = Math.max(1, Number(req.query['page'])  || 1);
  const limit = Math.min(Math.max(1, Number(req.query['limit']) || 20), 200);
  const status      = req.query['status']      as string | undefined;
  const search      = req.query['search']      as string | undefined;
  const vehicleType = req.query['vehicleType'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, page, limit, status, search, vehicleType));
}

export async function getVehicleInstallmentStats(req: AuthRequest, res: Response) {
  success(res, await svc.stats(req.user!.sellerId!));
}

export async function getVehicleInstallment(req: AuthRequest, res: Response) {
  success(res, await svc.getOne(req.params['id']!, req.user!.sellerId!));
}

export async function createVehicleInstallment(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.body), 201);
}

export async function recordVehiclePayment(req: AuthRequest, res: Response) {
  success(res, await svc.recordPayment(req.params['id']!, req.user!.sellerId!, req.body));
}

export async function defaultVehicleInstallment(req: AuthRequest, res: Response) {
  success(res, await svc.markDefault(req.params['id']!, req.user!.sellerId!));
}

export async function cancelVehicleInstallment(req: AuthRequest, res: Response) {
  success(res, await svc.cancel(req.params['id']!, req.user!.sellerId!, req.user!.userId!));
}

export async function deleteVehicleInstallment(req: AuthRequest, res: Response) {
  await svc.deleteVehicleInstallment(req.params['id']!, req.user!.sellerId!, req.user!.userId!);
  success(res, { deleted: true });
}

export async function deleteVehiclePayment(req: AuthRequest, res: Response) {
  const reason = req.body?.reason as string | undefined;
  success(res, await svc.deletePayment(
    req.params['paymentId']!, req.params['id']!, req.user!.sellerId!, req.user!.userId!, reason,
  ));
}

export async function updateVehicleInstallmentFields(req: AuthRequest, res: Response) {
  success(res, await svc.updateFields(req.params['id']!, req.user!.sellerId!, req.body));
}
