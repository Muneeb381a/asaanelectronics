import type { Request, Response } from 'express';
import type { PortalRequest } from '../../middleware/portalAuth.js';
import { PortalService } from './portal.service.js';
import { success } from '../../utils/response.js';
import { AppError } from '../../middleware/error.js';
import { recordFailure, recordSuccess } from '../../middleware/ipBlock.js';

const svc = new PortalService();

export async function portalLogin(req: Request, res: Response) {
  const { cnic, phone } = req.body as { cnic?: string; phone?: string };
  if (!cnic || !phone) throw new AppError('CNIC and phone are required', 400);

  const clean = { cnic: cnic.replace(/[-\s]/g, ''), phone: phone.trim() };
  if (!/^\d{13}$/.test(clean.cnic)) throw new AppError('CNIC must be 13 digits', 400);

  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  try {
    const result = await svc.login(clean.cnic, clean.phone);
    recordSuccess(ip);
    success(res, result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) recordFailure(ip);
    throw err;
  }
}

export async function portalMe(req: PortalRequest, res: Response) {
  success(res, await svc.getProfile(req.customer!.customerId));
}

export async function portalInstallments(req: PortalRequest, res: Response) {
  success(res, await svc.getInstallments(req.customer!.customerId));
}

export async function portalPayments(req: PortalRequest, res: Response) {
  success(res, await svc.getPayments(req.customer!.customerId, req.params['id']!));
}
