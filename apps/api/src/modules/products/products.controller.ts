import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ProductsService } from './products.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
import type { CreateProductInput } from '@assaan/shared';

const svc   = new ProductsService();
const audit = new AuditService();

export async function listProducts(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query['page']) || 1);
  const limit = Math.min(Math.max(1, Number(req.query['limit']) || 20), 100);
  const search = req.query['search'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, page, limit, search));
}

export async function createProduct(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.body as CreateProductInput);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PRODUCT_CREATED', entityType: 'PRODUCT', entityId: result.id,
    description: `Added product ${result.name} — PKR ${Number(result.price).toLocaleString()} (stock: ${result.stock})`,
    meta: { price: result.price, stock: result.stock },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function updateProduct(req: AuthRequest, res: Response) {
  const result = await svc.update(req.params['id']!, req.user!.sellerId!, req.body as { name?: string; price?: number; stock?: number; serial?: string });
  success(res, result);
  const body = req.body as Record<string, unknown>;
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PRODUCT_UPDATED', entityType: 'PRODUCT', entityId: result.id,
    description: `Updated product ${result.name}: ${Object.keys(body).join(', ')}`,
    meta: body,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function getInventoryIntelligence(req: AuthRequest, res: Response) {
  success(res, await svc.getIntelligence(req.user!.sellerId!));
}

export async function deleteProduct(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!, req.user!.userId);
  success(res, null);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PRODUCT_DELETED', entityType: 'PRODUCT', entityId: removed.id,
    description: `Deleted product ${removed.name} (was PKR ${Number(removed.price).toLocaleString()})`,
    ...auditCtx(req),
  }).catch(console.error);
}


export async function getValuation(req: AuthRequest, res: Response) {
  success(res, await svc.getValuation(req.user!.sellerId!));
}
