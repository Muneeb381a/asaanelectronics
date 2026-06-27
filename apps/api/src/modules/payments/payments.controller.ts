import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { PaymentsService } from './payments.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
const svc   = new PaymentsService();
const audit = new AuditService();

export async function listPayments(req: AuthRequest, res: Response) {
  const installmentId = req.query['installmentId'] as string | undefined;
  if (installmentId) {
    const page  = Math.max(1, parseInt(req.query['page']  as string) || 1);
    const limit = Math.max(1, parseInt(req.query['limit'] as string) || 50);
    success(res, await svc.listByInstallment(installmentId, req.user!.sellerId!, page, limit));
  } else {
    const from = req.query['from'] as string | undefined;
    const to   = req.query['to']   as string | undefined;
    success(res, await svc.listBySeller(req.user!.sellerId!, from, to));
  }
}

export async function patchPayment(req: AuthRequest, res: Response) {
  const { amount, method, note } = req.body as { amount?: number; method?: 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER'; note?: string };
  const result = await svc.update(req.params['id']!, req.user!.sellerId!, { amount, method, note });
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENT_UPDATED', entityType: 'PAYMENT', entityId: req.params['id']!,
    description: `Edited payment${amount !== undefined ? ` — new amount PKR ${Number(amount).toLocaleString()}` : ''}`,
    meta: { amount, method, note },
    ...auditCtx(req),
  }).catch(console.error);
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

export async function recordBulkPayments(req: AuthRequest, res: Response) {
  const { entries } = req.body as {
    entries: Array<{ installmentId: string; amount: number; method: string; note?: string }>;
  };
  if (!Array.isArray(entries)) {
    res.status(400).json({ message: 'entries must be an array' });
    return;
  }
  const result = await svc.recordBulk(req.user!.sellerId!, entries as Parameters<typeof svc.recordBulk>[1]);
  success(res, result, 200);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENTS_BULK', entityType: 'PAYMENT', entityId: 'bulk',
    description: `Bulk payment entry — ${result.succeeded} succeeded, ${result.failed.length} failed`,
    meta: { total: result.total, succeeded: result.succeeded, failed: result.failed.length },
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
