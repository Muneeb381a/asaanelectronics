import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { SessionsService } from './sessions.service.js';
import { success } from '../../utils/response.js';

const svc = new SessionsService();

export async function listSessions(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.user!.userId));
}

export async function revokeSession(req: AuthRequest, res: Response) {
  await svc.revoke(req.params['id']!, req.user!.userId);
  success(res, { revoked: true });
}

export async function revokeAllSessions(req: AuthRequest, res: Response) {
  // exceptId lets client keep its own session alive (pass current session id)
  const { exceptId } = req.body as { exceptId?: string };
  await svc.revokeAll(req.user!.userId, exceptId);
  success(res, { revoked: true });
}
