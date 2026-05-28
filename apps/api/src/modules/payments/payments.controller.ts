import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { PaymentsService } from './payments.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
const svc   = new PaymentsService();
const audit = new AuditService();

export async function listPayments(req: AuthRequest, res: Response) {
  const installmentId = req.query['installmentId'] as string;
  if (!installmentId) {
    res.status(400).json({ success: false, data: null, error: 'installmentId required' });
    return;
  }
  const page  = Math.max(1, parseInt(req.query['page']  as string) || 1);
  const limit = Math.max(1, parseInt(req.query['limit'] as string) || 50);
  success(res, await svc.listByInstallment(installmentId, req.user!.sellerId!, page, limit));
}

export async function deletePayment(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!, req.user!.userId);
  success(res, null);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENT_DELETED', entityType: 'PAYMENT', entityId: removed.id,
    description: `Soft-deleted payment PKR ${Number(removed.amount).toLocaleString()} via ${removed.method}`,
    meta: { amount: removed.amount, method: removed.method },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function recordPayment(req: AuthRequest, res: Response) {
  const result = await svc.record(req.user!.sellerId!, req.body);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENT_RECORDED', entityType: 'PAYMENT', entityId: result.payment.id,
    description: `Payment PKR ${Number(result.payment.amount).toLocaleString()} via ${result.payment.method}${result.completed ? ' — installment fully paid' : ` — PKR ${result.remaining.toLocaleString()} remaining`}`,
    meta: { amount: result.payment.amount, method: result.payment.method, remaining: result.remaining, completed: result.completed },
    ...auditCtx(req),
  }).catch(console.error);
}
