import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { InstallmentsService } from './installments.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
const svc   = new InstallmentsService();
const audit = new AuditService();

export async function listInstallments(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query['page']) || 1);
  const isExport = req.query['export'] === '1';
  const limit = isExport
    ? Math.min(Number(req.query['limit']) || 5000, 5000)
    : Math.min(Math.max(1, Number(req.query['limit']) || 20), 100);
  const status     = req.query['status']     as string | undefined;
  const search     = req.query['search']     as string | undefined;
  const customerId = req.query['customerId'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, page, limit, status, search, customerId));
}

export async function getInstallment(req: AuthRequest, res: Response) {
  success(res, await svc.getOne(req.params['id']!, req.user!.sellerId!));
}

export async function createInstallment(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.body);
  success(res, result, 201);
  void svc.getOne(result.id, req.user!.sellerId!).then((d) =>
    audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'INSTALLMENT_CREATED', entityType: 'INSTALLMENT', entityId: result.id,
      description: `New installment — ${d.customerName} · ${d.productName} — PKR ${Number(d.totalAmount).toLocaleString()} / ${d.months} months`,
      meta: { totalAmount: d.totalAmount, downPayment: d.downPayment, months: d.months, monthly: d.monthly },
      ...auditCtx(req),
    }),
  ).catch(console.error);
}

export async function defaultInstallment(req: AuthRequest, res: Response) {
  const result = await svc.markDefault(req.params['id']!, req.user!.sellerId!);
  success(res, result);
  void svc.getOne(result.id, req.user!.sellerId!).then((d) =>
    audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'INSTALLMENT_DEFAULTED', entityType: 'INSTALLMENT', entityId: result.id,
      description: `Marked as DEFAULTED — ${d.customerName} · ${d.productName}`,
      ...auditCtx(req),
    }),
  ).catch(console.error);
}

export async function cancelInstallment(req: AuthRequest, res: Response) {
  const result = await svc.cancel(req.params['id']!, req.user!.sellerId!);
  success(res, result);
  void svc.getOne(result.id, req.user!.sellerId!).then((d) =>
    audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'INSTALLMENT_CANCELLED', entityType: 'INSTALLMENT', entityId: result.id,
      description: `Cancelled installment — ${d.customerName} · ${d.productName}`,
      ...auditCtx(req),
    }),
  ).catch(console.error);
}

export async function deleteInstallment(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!, req.user!.userId);
  success(res, null);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_DELETED', entityType: 'INSTALLMENT', entityId: removed.id,
    description: `Soft-deleted installment — ${removed.customerName} · ${removed.productName} (PKR ${Number(removed.totalAmount).toLocaleString()})`,
    meta: { totalAmount: removed.totalAmount, status: removed.status },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function approveInstallment(req: AuthRequest, res: Response) {
  const result = await svc.approve(req.params['id']!, req.user!.sellerId!);
  success(res, result);
  void svc.getOne(result.id, req.user!.sellerId!).then((d) =>
    audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'INSTALLMENT_APPROVED', entityType: 'INSTALLMENT', entityId: result.id,
      description: `Approved installment — ${d.customerName} · ${d.productName} — PKR ${Number(d.totalAmount).toLocaleString()} / ${d.months} months`,
      ...auditCtx(req),
    }),
  ).catch(console.error);
}

export async function closeInstallment(req: AuthRequest, res: Response) {
  const result = await svc.close(req.params['id']!, req.user!.sellerId!);
  success(res, result);
  void svc.getOne(result.id, req.user!.sellerId!).then((d) =>
    audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'INSTALLMENT_CLOSED', entityType: 'INSTALLMENT', entityId: result.id,
      description: `Closed installment — ${d.customerName} · ${d.productName}`,
      ...auditCtx(req),
    }),
  ).catch(console.error);
}

export async function rescheduleInstallment(req: AuthRequest, res: Response) {
  const before = await svc.getOne(req.params['id']!, req.user!.sellerId!);
  const result = await svc.reschedule(req.params['id']!, req.user!.sellerId!, req.body);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_RESCHEDULED', entityType: 'INSTALLMENT', entityId: result.id,
    description: `Rescheduled — ${before.customerName} · ${before.productName}: ${before.months} mo → ${result.months} mo, PKR ${Number(before.monthly).toFixed(0)}/mo → PKR ${Number(result.monthly).toFixed(0)}/mo`,
    before:  { months: before.months,  monthly: Number(before.monthly).toFixed(0) },
    after:   { months: result.months,  monthly: Number(result.monthly).toFixed(0) },
    reason:  (req.body as Record<string, unknown>)['reason'] as string | undefined,
    ...auditCtx(req),
  }).catch(console.error);
}
