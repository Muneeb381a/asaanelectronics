import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { AuditService } from './audit.service.js';
import { success } from '../../utils/response.js';

const svc = new AuditService();

export async function listAuditLogs(req: AuthRequest, res: Response) {
  const { from, to, userId, action, entityType, page, limit } = req.query as Record<string, string>;
  success(res, await svc.list(req.user!.sellerId!, {
    from, to, userId, action, entityType,
    page:  page  ? Number(page)  : undefined,
    limit: limit ? Number(limit) : undefined,
  }));
}
