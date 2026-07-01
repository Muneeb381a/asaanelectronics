import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { RecoveryService } from './recovery.service.js';
import { AuditService } from '../audit/audit.service.js';
import { auditCtx } from '../../utils/auditCtx.js';
import { success } from '../../utils/response.js';

const svc   = new RecoveryService();
const audit = new AuditService();

export async function listRecoveryActions(req: AuthRequest, res: Response) {
  const installmentId = req.query['installmentId'] as string;
  if (!installmentId) {
    res.status(400).json({ success: false, data: null, error: 'installmentId required' });
    return;
  }
  success(res, await svc.list(installmentId, req.user!.sellerId!));
}

export async function createRecoveryAction(req: AuthRequest, res: Response) {
  const action = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, action, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'RECOVERY_ACTION_CREATED', entityType: 'RECOVERY',
    entityId: action.id,
    description: `Recovery action [${action.type}] on installment ${action.installmentId}${action.note ? ` — ${action.note}` : ''}`,
    meta: { type: action.type, installmentId: action.installmentId },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function deleteRecoveryAction(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, { deleted: true });
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'RECOVERY_ACTION_DELETED', entityType: 'RECOVERY',
    entityId: req.params['id']!,
    description: `Deleted recovery action ${req.params['id']}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function listPromisesDue(req: AuthRequest, res: Response) {
  success(res, await svc.promisesDue(req.user!.sellerId!));
}

export async function listAllPromises(req: AuthRequest, res: Response) {
  success(res, await svc.allPromises(req.user!.sellerId!));
}

export async function listAgentStats(req: AuthRequest, res: Response) {
  success(res, await svc.agentStats(req.user!.sellerId!));
}

export async function listAgentCollections(req: AuthRequest, res: Response) {
  const page  = Number(req.query['page']  ?? 1);
  const limit = Number(req.query['limit'] ?? 50);
  success(res, await svc.agentCollections(req.params['userId']!, req.user!.sellerId!, page, limit));
}
