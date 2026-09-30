import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { StaffExpenseClaimsService } from './staffExpenseClaims.service.js';
import { success } from '../../utils/response.js';

const svc = new StaffExpenseClaimsService();

export async function listClaims(req: AuthRequest, res: Response) {
  const staffId = req.user!.role === 'SELLER_STAFF' ? req.user!.userId : (req.query['staffId'] as string | undefined);
  success(res, await svc.list(req.user!.sellerId!, staffId));
}

export async function createClaim(req: AuthRequest, res: Response) {
  const row = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, row, 201);
}

export async function approveClaim(req: AuthRequest, res: Response) {
  success(res, await svc.approve(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body));
}

export async function rejectClaim(req: AuthRequest, res: Response) {
  success(res, await svc.reject(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body?.ownerNote));
}
