import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { StaffService } from './staff.service.js';
import { AuditService } from '../audit/audit.service.js';
import { auditCtx } from '../../utils/auditCtx.js';
import { success } from '../../utils/response.js';

const svc   = new StaffService();
const audit = new AuditService();

export async function listStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    success(res, await svc.list(req.user!.sellerId!));
  } catch (e) { next(e); }
}

export async function createStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.create(req.user!.sellerId!, req.body);
    res.status(201).json({ success: true, data });
    void audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'STAFF_CREATED', entityType: 'STAFF', entityId: data.id,
      description: `Added staff member ${data.name} (${data.email})`,
      meta: { role: data.role, permissions: data.permissions },
      ...auditCtx(req),
    }).catch(console.error);
  } catch (e) { next(e); }
}

export async function updatePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const before = await svc.getPermissions(req.params['id']!, req.user!.sellerId!);
    const data   = await svc.updatePermissions(req.params['id']!, req.user!.sellerId!, req.body);
    success(res, data);
    void audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'STAFF_PERMISSIONS_CHANGED', entityType: 'STAFF', entityId: data.id,
      description: `Updated permissions for ${data.name}`,
      before:  before  as Record<string, unknown>,
      after:   data.permissions as Record<string, unknown>,
      ...auditCtx(req),
    }).catch(console.error);
  } catch (e) { next(e); }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { commissionRate, monthlySalary } = req.body as { commissionRate?: number | null; monthlySalary?: number | null };
    const data = await svc.updateProfile(req.params['id']!, req.user!.sellerId!, { commissionRate, monthlySalary });
    success(res, data);
  } catch (e) { next(e); }
}

export async function removeStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const member = await svc.getOne(req.params['id']!, req.user!.sellerId!);
    await svc.remove(req.params['id']!, req.user!.sellerId!);
    success(res, null);
    void audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'STAFF_REMOVED', entityType: 'STAFF', entityId: req.params['id']!,
      description: `Removed staff member ${member.name} (${member.email})`,
      ...auditCtx(req),
    }).catch(console.error);
  } catch (e) { next(e); }
}

export async function freezeStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { durationMonths } = req.body as { durationMonths: number | 'permanent' };
    const data = await svc.freeze(req.params['id']!, req.user!.sellerId!, durationMonths);
    success(res, data);
    const label = durationMonths === 'permanent' ? 'permanently' : `for ${durationMonths} month(s)`;
    void audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'STAFF_FROZEN', entityType: 'STAFF', entityId: data.id,
      description: `Froze staff member ${data.name} ${label} (until ${data.frozenUntil?.toISOString()})`,
      meta: { durationMonths, frozenUntil: data.frozenUntil },
      ...auditCtx(req),
    }).catch(console.error);
  } catch (e) { next(e); }
}

export async function unfreezeStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.unfreeze(req.params['id']!, req.user!.sellerId!);
    success(res, data);
    void audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'STAFF_UNFROZEN', entityType: 'STAFF', entityId: data.id,
      description: `Unfroze staff member ${data.name}`,
      ...auditCtx(req),
    }).catch(console.error);
  } catch (e) { next(e); }
}

// ── Commission ────────────────────────────────────────────────────────────────

export async function getCommissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const month = req.query['month'] as string | undefined;
    success(res, await svc.commissions(req.user!.sellerId!, month));
  } catch (e) { next(e); }
}

export async function payCommission(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { staffId, month, amount, note } = req.body as { staffId: string; month: string; amount: number; note?: string };
    const data = await svc.payCommission(req.user!.sellerId!, req.user!.userId, { staffId, month, amount, note });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteCommissionPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { staffId, month } = req.body as { staffId: string; month: string };
    const data = await svc.deleteCommissionPayment(req.user!.sellerId!, staffId, month);
    success(res, data);
  } catch (e) { next(e); }
}

// ── Salary ────────────────────────────────────────────────────────────────────

export async function listSalaries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const month = req.query['month'] as string | undefined;
    success(res, await svc.listSalaries(req.user!.sellerId!, month));
  } catch (e) { next(e); }
}

export async function paySalary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { staffId, month, amount, note } = req.body as { staffId: string; month: string; amount: number; note?: string };
    const data = await svc.paySalary(req.user!.sellerId!, req.user!.userId, { staffId, month, amount, note });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteSalaryPayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { staffId, month } = req.body as { staffId: string; month: string };
    const data = await svc.deleteSalaryPayment(req.user!.sellerId!, staffId, month);
    success(res, data);
  } catch (e) { next(e); }
}

// ── Collections Report ────────────────────────────────────────────────────────

export async function getCollections(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from  = (req.query['from'] as string | undefined) ?? today;
    const to    = (req.query['to']   as string | undefined) ?? today;
    success(res, await svc.collections(req.user!.sellerId!, from, to));
  } catch (e) { next(e); }
}
