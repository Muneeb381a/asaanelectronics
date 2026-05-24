import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { ProfileService } from './profile.service.js';
import { success } from '../../utils/response.js';

const svc = new ProfileService();

export async function getMe(req: AuthRequest, res: Response) {
  success(res, await svc.getMe(req.user!.userId));
}

export async function updateProfile(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.user!.userId, req.body));
}

export async function changePassword(req: AuthRequest, res: Response) {
  await svc.changePassword(req.user!.userId, req.body);
  success(res, null);
}
