import type { AuthRequest } from '../middleware/auth.js';

export function auditCtx(req: AuthRequest) {
  return {
    ip:        req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
    sessionId: req.user?.sessionId,
  };
}
