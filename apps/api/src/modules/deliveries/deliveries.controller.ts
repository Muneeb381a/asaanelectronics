import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { DeliveriesService } from './deliveries.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';

const svc   = new DeliveriesService();
const audit = new AuditService();

const isOwner = (req: AuthRequest) => req.user!.role === 'SELLER_OWNER' || req.user!.role === 'SUPER_ADMIN';

export async function listDeliveries(req: AuthRequest, res: Response) {
  const status = req.query['status'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, { userId: req.user!.userId, isOwner: isOwner(req) }, status));
}

export async function listDrivers(req: AuthRequest, res: Response) {
  success(res, await svc.listDrivers(req.user!.sellerId!));
}

export async function createDelivery(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'DELIVERY_CREATED', entityType: 'DELIVERY', entityId: result.id,
    description: `Delivery slip ${result.slipNumber} — ${result.productName} x${result.quantity} · ${result.customerName}`,
    meta: { slipNumber: result.slipNumber, saleType: result.saleType },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function dispatchDelivery(req: AuthRequest, res: Response) {
  const result = await svc.dispatch(req.params['id']!, req.user!.sellerId!);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'DELIVERY_DISPATCHED', entityType: 'DELIVERY', entityId: result.id,
    description: `Dispatched ${result.slipNumber} with driver ${result.driverName}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function markDeliveredDelivery(req: AuthRequest, res: Response) {
  const result = await svc.markDelivered(req.params['id']!, req.user!.sellerId!, req.body);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'DELIVERY_DELIVERED', entityType: 'DELIVERY', entityId: result.id,
    description: `${result.slipNumber} delivered — ${result.customerName}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function markRejectedDelivery(req: AuthRequest, res: Response) {
  const result = await svc.markRejected(req.params['id']!, req.user!.sellerId!, req.body);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'DELIVERY_REJECTED', entityType: 'DELIVERY', entityId: result.id,
    description: `${result.slipNumber} rejected — ${result.rejectionReason}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function markStockReversedDelivery(req: AuthRequest, res: Response) {
  success(res, await svc.markStockReversed(req.params['id']!, req.user!.sellerId!));
}

export async function cancelDelivery(req: AuthRequest, res: Response) {
  const result = await svc.cancel(req.params['id']!, req.user!.sellerId!);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'DELIVERY_CANCELLED', entityType: 'DELIVERY', entityId: result.id,
    description: `${result.slipNumber} cancelled`,
    ...auditCtx(req),
  }).catch(console.error);
}
