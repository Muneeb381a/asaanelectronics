import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { CashSalesService } from './cashSales.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';

const svc   = new CashSalesService();
const audit = new AuditService();

export async function listCashSales(req: AuthRequest, res: Response) {
  const page  = Math.max(1, Number(req.query['page']) || 1);
  const limit = Math.min(Math.max(1, Number(req.query['limit']) || 20), 5000);
  const from   = req.query['from']   as string | undefined;
  const to     = req.query['to']     as string | undefined;
  const search = req.query['search'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, page, limit, from, to, search));
}

export async function createCashSale(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'CASH_SALE_CREATED', entityType: 'CASH_SALE', entityId: result.id,
    description: `Cash sale — ${result.productName} x${result.quantity} · PKR ${Number(result.amount).toLocaleString()}${result.customerName ? ` · ${result.customerName}` : ''}`,
    meta: { amount: result.amount, quantity: result.quantity, method: result.method },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function deleteCashSale(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, { deleted: true });
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'CASH_SALE_DELETED', entityType: 'CASH_SALE', entityId: removed.id,
    description: `Deleted cash sale — PKR ${Number(removed.amount).toLocaleString()} (stock restored)`,
    ...auditCtx(req),
  }).catch(console.error);
}
