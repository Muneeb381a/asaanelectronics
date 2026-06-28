import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { RepossessionsService } from './repossessions.service.js';
import { success } from '../../utils/response.js';

const svc = new RepossessionsService();

export async function listRepossessions(req: AuthRequest, res: Response) {
  const page   = Math.max(1, Number(req.query['page'])  || 1);
  const limit  = Math.min(Math.max(1, Number(req.query['limit']) || 30), 100);
  const status = req.query['status'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, { status, page, limit }));
}

export async function getRepossessionStats(req: AuthRequest, res: Response) {
  success(res, await svc.getStats(req.user!.sellerId!));
}

export async function createRepossession(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.body), 201);
}

export async function updateRepossession(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.params['id']!, req.user!.sellerId!, req.body));
}

export async function removeRepossession(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, null);
}
