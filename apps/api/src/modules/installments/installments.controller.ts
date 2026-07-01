import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { InstallmentsService } from './installments.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
import { importInstallmentsSchema, updateInstallmentSchema } from '@assaan/shared';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
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
  const frequency  = req.query['frequency']  as string | undefined;
  const sortBy     = req.query['sortBy']     as string | undefined;
  const sortDir    = req.query['sortDir']    as string | undefined;

  // Staff without canViewAllInstallments see only their own customers' installments.
  // Owners and staff with the permission see all shop installments.
  let staffUserId: string | undefined;
  if (req.user!.role !== 'SELLER_OWNER') {
    const member = await db.query.users.findFirst({
      where: eq(users.id, req.user!.userId),
      columns: { permissions: true },
    });
    const canViewAll = member?.permissions?.canViewAllInstallments ?? true;
    if (!canViewAll) staffUserId = req.user!.userId;
  }

  success(res, await svc.list(req.user!.sellerId!, page, limit, status, search, customerId, frequency, sortBy, sortDir, staffUserId));
}

export async function getInstallment(req: AuthRequest, res: Response) {
  success(res, await svc.getOne(req.params['id']!, req.user!.sellerId!));
}

export async function getDueSheet(req: AuthRequest, res: Response) {
  success(res, await svc.dueSheet(req.user!.sellerId!));
}

export async function createInstallment(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.body);
  success(res, result, 201);
  // customerName and productName come directly from create() — no extra DB call needed
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_CREATED', entityType: 'INSTALLMENT', entityId: result.id,
    description: `New installment — ${result.customerName} · ${result.productName} — PKR ${Number(result.totalAmount).toLocaleString()} / ${result.months} months`,
    meta: { totalAmount: result.totalAmount, downPayment: result.downPayment, months: result.months, monthly: result.monthly },
    ...auditCtx(req),
  }).catch(console.error);
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

export async function updateInstallment(req: AuthRequest, res: Response) {
  const parsed = updateInstallmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? 'Invalid payload' });
    return;
  }
  const before = await svc.getOne(req.params['id']!, req.user!.sellerId!);
  const result = await svc.update(req.params['id']!, req.user!.sellerId!, parsed.data);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_UPDATED', entityType: 'INSTALLMENT', entityId: result.id,
    description: `Edited installment — ${result.customerName} · ${result.productName}`,
    before: { totalAmount: before.totalAmount, downPayment: before.downPayment, monthly: before.monthly, months: before.months },
    after:  { totalAmount: result.totalAmount, downPayment: result.downPayment, monthly: result.monthly, months: result.months },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function waiverInstallment(req: AuthRequest, res: Response) {
  const { amount, reason } = req.body as { amount: number; reason?: string };
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ message: 'amount must be a positive number' });
    return;
  }
  const before = await svc.getOne(req.params['id']!, req.user!.sellerId!);
  const result = await svc.waiver(req.params['id']!, req.user!.sellerId!, { amount, reason });
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_WAIVER', entityType: 'INSTALLMENT', entityId: result.id,
    description: `Balance waiver PKR ${amount.toLocaleString()} — ${before.customerName} · ${before.productName}${reason ? ` (${reason})` : ''}`,
    before: { remaining: before.remaining },
    after:  { remaining: result?.remaining },
    reason,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function getSettlement(req: AuthRequest, res: Response) {
  const inst = await svc.getOne(req.params['id']!, req.user!.sellerId!);
  const remaining = Number(inst.remaining);

  // Owner can configure early-settlement discount % via seller settings (future)
  // For now: flat 0% discount (full remaining). Endpoint exists so frontend + future discount are wired.
  const discountPercent = 0;
  const discountAmount  = Math.round(remaining * discountPercent / 100);
  const settlementAmount = remaining - discountAmount;

  success(res, {
    installmentId:   inst.id,
    customerName:    inst.customerName,
    productName:     inst.productName,
    remaining,
    discountPercent,
    discountAmount,
    settlementAmount,
    status:          inst.status,
  });
}

export async function pauseInstallment(req: AuthRequest, res: Response) {
  const months = Number(req.body.months);
  const reason = req.body.reason as string | undefined;
  const result = await svc.pause(req.params['id']!, req.user!.sellerId!, req.user!.userId, { months, reason });
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_PAUSED', entityType: 'INSTALLMENT', entityId: result.id,
    description: `Installment paused for ${months} month${months !== 1 ? 's' : ''}${reason ? ` — ${reason}` : ''}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function unpauseInstallment(req: AuthRequest, res: Response) {
  const result = await svc.unpause(req.params['id']!, req.user!.sellerId!);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_UNPAUSED', entityType: 'INSTALLMENT', entityId: result.id,
    description: 'Installment pause removed',
    ...auditCtx(req),
  }).catch(console.error);
}

export async function importInstallments(req: AuthRequest, res: Response) {
  const parsed = importInstallmentsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? 'Invalid payload' });
    return;
  }
  const result = await svc.bulkImport(parsed.data.rows, req.user!.sellerId!, req.user!.userId);
  success(res, result, 200);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENTS_IMPORTED', entityType: 'INSTALLMENT', entityId: 'bulk',
    description: `Bulk import — ${result.imported} imported, ${result.errors.length} failed`,
    meta: { imported: result.imported, customersCreated: result.customersCreated, productsCreated: result.productsCreated },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function listOverdueWithStage(req: AuthRequest, res: Response) {
  const search = req.query['search'] as string | undefined;
  const rows = await svc.overdueWithStage(req.user!.sellerId!, search?.trim() || undefined);
  success(res, rows);
}

export async function transferInstallment(req: AuthRequest, res: Response) {
  const result = await svc.transfer(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'INSTALLMENT_TRANSFERRED', entityType: 'INSTALLMENT', entityId: req.params['id']!,
    description: `Installment ${req.params['id']!} transferred from ${result.oldCustomerName} to ${result.newCustomerName}${result.reason ? ` — ${result.reason}` : ''}. New installment: ${result.newInstallment.id}`,
    meta: { oldId: result.oldId, newId: result.newInstallment.id, newCustomerName: result.newCustomerName, reason: result.reason },
    ...auditCtx(req),
  }).catch(console.error);
}
