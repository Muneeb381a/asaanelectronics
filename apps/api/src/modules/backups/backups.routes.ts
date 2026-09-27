import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../config/env.js';
import { listBackups, createBackup, downloadBackup, restoreBackup, nightlyBackupCron } from './backups.controller.js';

const router = Router();

// Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`; must sit before authenticate().
function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  if (!env.CRON_SECRET || req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    return next(new AppError('Unauthorized', 401));
  }
  next();
}
router.get('/cron', requireCronSecret, nightlyBackupCron);

router.use(authenticate, requireSeller);

router.get('/', requirePermission('canExportData'), listBackups);
router.post('/', requirePermission('canExportData'), createBackup);
router.get('/:id/download', requirePermission('canExportData'), downloadBackup);
// Restore is owner-only — staff can back up and see the list, only the owner can
// roll the shop's live data back to a snapshot.
router.post('/:id/restore', requireOwner, restoreBackup);

export default router;
