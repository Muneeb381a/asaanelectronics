import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ExportsService } from './exports.service.js';
import { success } from '../../utils/response.js';

const svc = new ExportsService();

export async function getFullBackup(req: AuthRequest, res: Response) {
  success(res, await svc.getFullBackup(req.user!.sellerId!));
}
