import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { HandoversService } from './handovers.service.js';
import { AuditService } from '../audit/audit.service.js';
import { auditCtx } from '../../utils/auditCtx.js';
import { success } from '../../utils/response.js';

const svc   = new HandoversService();
const audit = new AuditService();

export async function listHandovers(req: AuthRequest, res: Response) {
  const { staffId, date } = req.query as Record<string, string>;
  const effectiveStaffId = req.user!.role === 'SELLER_STAFF' ? req.user!.userId : staffId;
  success(res, await svc.list(req.user!.sellerId!, effectiveStaffId, date));
}

export async function getCollectedToday(req: AuthRequest, res: Response) {
  const staffId = req.user!.role === 'SELLER_STAFF' ? req.user!.userId : (req.query['staffId'] as string);
  if (!staffId) return success(res, { collected: 0 });
  const collected = await svc.collectedToday(req.user!.sellerId!, staffId);
  success(res, { collected });
}

// GET /handovers/pending-balances  — owner only (all staff)
// GET /handovers/my-balance        — any staff or owner (own balance)
export async function getPendingBalances(req: AuthRequest, res: Response) {
  success(res, await svc.pendingBalances(req.user!.sellerId!));
}

export async function getMyBalance(req: AuthRequest, res: Response) {
  const staffId = req.user!.role === 'SELLER_STAFF'
    ? req.user!.userId
    : (req.query['staffId'] as string | undefined) ?? req.user!.userId;
  const rows = await svc.pendingBalances(req.user!.sellerId!, staffId);
  success(res, rows[0] ?? null);
}

export async function createHandover(req: AuthRequest, res: Response) {
  const row = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, row, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'HANDOVER_SUBMITTED', entityType: 'HANDOVER', entityId: row.id,
    description: `Cash handover submitted: PKR ${row.handedAmount}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function confirmHandover(req: AuthRequest, res: Response) {
  const row = await svc.confirm(req.params['id']!, req.user!.sellerId!, req.user!.userId, req.body);
  success(res, row);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'HANDOVER_CONFIRMED', entityType: 'HANDOVER', entityId: row.id,
    description: `Handover confirmed: PKR ${row.confirmedAmount} (submitted: PKR ${row.handedAmount})`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function disputeHandover(req: AuthRequest, res: Response) {
  const row = await svc.dispute(req.params['id']!, req.user!.sellerId!, req.body?.ownerNote);
  success(res, row);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'HANDOVER_DISPUTED', entityType: 'HANDOVER', entityId: row.id,
    description: `Handover disputed${row.ownerNote ? `: ${row.ownerNote}` : ''}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function reopenHandover(req: AuthRequest, res: Response) {
  const row = await svc.reopen(req.params['id']!, req.user!.sellerId!);
  success(res, row);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'HANDOVER_REOPENED', entityType: 'HANDOVER', entityId: row.id,
    description: `Disputed handover reopened to pending`,
    ...auditCtx(req),
  }).catch(console.error);
}
