import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { StaffService } from './staff.service.js';
import { AuditService } from '../audit/audit.service.js';
import { auditCtx } from '../../utils/auditCtx.js';

const svc   = new StaffService();
const audit = new AuditService();

export async function listStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await svc.list(req.user!.sellerId!);
    res.json({ success: true, data });
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
    res.json({ success: true, data });
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

export async function removeStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const member = await svc.getOne(req.params['id']!, req.user!.sellerId!);
    await svc.remove(req.params['id']!, req.user!.sellerId!);
    res.json({ success: true, data: null });
    void audit.log({
      sellerId: req.user!.sellerId!, userId: req.user!.userId,
      action: 'STAFF_REMOVED', entityType: 'STAFF', entityId: req.params['id']!,
      description: `Removed staff member ${member.name} (${member.email})`,
      ...auditCtx(req),
    }).catch(console.error);
  } catch (e) { next(e); }
}
