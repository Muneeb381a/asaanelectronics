import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { GuarantorsService } from './guarantors.service.js';
import { success } from '../../utils/response.js';

const svc = new GuarantorsService();

export async function listGuarantors(req: AuthRequest, res: Response) {
  const search = req.query['search'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, search));
}
