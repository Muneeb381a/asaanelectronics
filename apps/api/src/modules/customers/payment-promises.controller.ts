import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { PaymentPromisesService } from './payment-promises.service.js';
import { resolveStaffScope, assertCustomerInScope } from '../../utils/staffScope.js';
import { success } from '../../utils/response.js';

const svc = new PaymentPromisesService();

export async function listPromises(req: AuthRequest, res: Response) {
  await assertCustomerInScope(req.params['customerId']!, req.user!.sellerId!, await resolveStaffScope(req));
  success(res, await svc.list(req.params['customerId']!, req.user!.sellerId!));
}

export async function createPromise(req: AuthRequest, res: Response) {
  await assertCustomerInScope(req.params['customerId']!, req.user!.sellerId!, await resolveStaffScope(req));
  const result = await svc.create(req.params['customerId']!, req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result, 201);
}

export async function cancelPromise(req: AuthRequest, res: Response) {
  await svc.cancel(req.params['promiseId']!, req.user!.sellerId!, req.user!.userId);
  success(res, null);
}

export async function listPromiseFollowUps(req: AuthRequest, res: Response) {
  const staffScope = await resolveStaffScope(req);
  success(res, await svc.followUps(req.user!.sellerId!, staffScope));
}
