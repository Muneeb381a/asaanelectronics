import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ExpensesService } from './expenses.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
const svc   = new ExpensesService();
const audit = new AuditService();

export async function listExpenses(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.user!.sellerId!, req.query['from'] as string, req.query['to'] as string));
}

export async function createExpense(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.body);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: result.id,
    description: `Recorded expense ${result.category} PKR ${Number(result.amount).toLocaleString()}${result.description ? ` — ${result.description}` : ''}`,
    meta: { category: result.category, amount: result.amount },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function updateExpense(req: AuthRequest, res: Response) {
  const result = await svc.update(req.params['id']!, req.user!.sellerId!, req.body);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'EXPENSE_UPDATED', entityType: 'EXPENSE', entityId: result.id,
    description: `Updated expense ${result.category} PKR ${Number(result.amount).toLocaleString()}`,
    meta: { category: result.category, amount: result.amount },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function deleteExpense(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, { deleted: true });
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'EXPENSE_DELETED', entityType: 'EXPENSE', entityId: removed.id,
    description: `Deleted expense ${removed.category} PKR ${Number(removed.amount).toLocaleString()}${removed.description ? ` — ${removed.description}` : ''}`,
    ...auditCtx(req),
  }).catch(console.error);
}
