import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../config/env.js';
import { listAuditLogs, cleanupAuditLogs } from './audit.controller.js';

const router = Router();

// Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`; must sit before authenticate().
function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  if (!env.CRON_SECRET || req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    return next(new AppError('Unauthorized', 401));
  }
  next();
}
router.get('/cleanup', requireCronSecret, cleanupAuditLogs);

router.use(authenticate, requireSeller, requireOwner);

router.get('/', listAuditLogs);
router.post('/cleanup', cleanupAuditLogs);

export default router;
