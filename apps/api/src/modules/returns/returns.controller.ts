import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ReturnsService } from './returns.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';

const svc   = new ReturnsService();
const audit = new AuditService();

export async function listReturns(req: AuthRequest, res: Response) {
  const page       = Math.max(1, Number(req.query['page']) || 1);
  const limit      = Math.min(Math.max(1, Number(req.query['limit']) || 20), 100);
  const status     = req.query['status']     as string | undefined;
  const customerId = req.query['customerId'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, page, limit, status, customerId));
}

export async function getReturn(req: AuthRequest, res: Response) {
  success(res, await svc.getOne(req.params['id']!, req.user!.sellerId!));
}

export async function createReturn(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'RETURN_CREATED', entityType: 'RETURN', entityId: result.id,
    description: `Return request — ${result.customerName} · ${result.productName} [${result.type} / ${result.reason}]`,
    meta: { type: result.type, reason: result.reason, condition: result.condition },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function resolveReturn(req: AuthRequest, res: Response) {
  const result = await svc.resolve(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'RETURN_RESOLVED', entityType: 'RETURN', entityId: result.id,
    description: `Return ${result.status} — resolution: ${result.resolutionType ?? 'N/A'}${result.refundAmount ? ` · Refund PKR ${Number(result.refundAmount).toLocaleString()}` : ''}`,
    meta: { status: result.status, resolutionType: result.resolutionType, refundAmount: result.refundAmount },
    ...auditCtx(req),
  }).catch(console.error);
}
