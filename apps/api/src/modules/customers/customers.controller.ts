import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { CustomersService } from './customers.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';

const svc   = new CustomersService();
const audit = new AuditService();

function changedFields(body: Record<string, unknown>): string {
  const map: Record<string, string> = {
    name: 'name', phone: 'phone', cnic: 'CNIC', address: 'address',
    occupation: 'occupation', employer: 'employer',
    guarantorName: 'guarantor info', guarantorPhone: 'guarantor info', guarantorCnic: 'guarantor info',
    guarantor2Name: 'guarantor 2 info', guarantor2Phone: 'guarantor 2 info', guarantor2Cnic: 'guarantor 2 info',
    photoUrl: 'documents', cnicFrontUrl: 'documents', cnicBackUrl: 'documents',
  };
  const unique = [...new Set(Object.keys(body).map((k) => map[k]).filter(Boolean))];
  return unique.length ? unique.join(', ') : 'details';
}

export async function lookupByCnic(req: AuthRequest, res: Response) {
  const cnic = (req.query['cnic'] as string ?? '').replace(/-/g, '');
  if (cnic.length < 13) return success(res, { ownRecord: null, bureau: null });
  success(res, await svc.lookupByCnic(req.user!.sellerId!, cnic));
}

export async function listCustomers(req: AuthRequest, res: Response) {
  const page      = Math.max(1, Number(req.query['page']) || 1);
  const limit     = Math.min(Math.max(1, Number(req.query['limit']) || 20), 100);
  const search             = req.query['search']             as string | undefined;
  const lifecycle          = req.query['lifecycle']          as string | undefined;
  const verificationStatus = req.query['verificationStatus'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, page, limit, search, lifecycle, verificationStatus));
}

export async function getLifecycleCounts(req: AuthRequest, res: Response) {
  success(res, await svc.lifecycleCounts(req.user!.sellerId!));
}

export async function getCustomer(req: AuthRequest, res: Response) {
  success(res, await svc.getOne(req.params['id']!, req.user!.sellerId!));
}

export async function createCustomer(req: AuthRequest, res: Response) {
  const result = await svc.create(req.user!.sellerId!, req.body, req.user!.userId);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'CUSTOMER_CREATED', entityType: 'CUSTOMER', entityId: result.id,
    description: `Added customer ${result.name} (CNIC: ${result.cnicMasked})`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function updateCustomer(req: AuthRequest, res: Response) {
  const result = await svc.update(req.params['id']!, req.user!.sellerId!, req.body);
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'CUSTOMER_UPDATED', entityType: 'CUSTOMER', entityId: result.id,
    description: `Updated customer ${result.name}: ${changedFields(req.body as Record<string, unknown>)}`,
    meta: { fields: Object.keys(req.body as object) },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function deleteCustomer(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!, req.user!.userId);
  success(res, null);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'CUSTOMER_DELETED', entityType: 'CUSTOMER', entityId: removed.id,
    description: `Deleted customer ${removed.name} (CNIC: ${removed.cnicMasked})`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function getRiskBreakdown(req: AuthRequest, res: Response) {
  success(res, await svc.getRiskBreakdown(req.params['id']!, req.user!.sellerId!));
}

export async function assignAvo(req: AuthRequest, res: Response) {
  const { avoId } = req.body as { avoId: string };
  success(res, await svc.assignAvo(req.params['id']!, req.user!.sellerId!, avoId));
}
