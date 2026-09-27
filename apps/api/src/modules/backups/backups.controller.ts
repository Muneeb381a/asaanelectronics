import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
import { AuditService } from '../audit/audit.service.js';
import * as backupsSvc from './backups.service.js';

const audit = new AuditService();
const MANUAL_COOLDOWN_MS = 60 * 60 * 1000;

export async function listBackups(req: AuthRequest, res: Response) {
  success(res, await backupsSvc.listBackups(req.user!.sellerId!));
}

export async function createBackup(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const existing = await backupsSvc.listBackups(sellerId);
  const lastManual = existing.find((b) => b.trigger === 'manual');
  if (lastManual && Date.now() - new Date(lastManual.createdAt).getTime() < MANUAL_COOLDOWN_MS) {
    throw new AppError('A manual backup was already taken in the last hour. Try again later.', 429);
  }
  const result = await backupsSvc.createBackup(sellerId, 'manual');
  await audit.log({
    sellerId, userId: req.user!.userId, action: 'BACKUP_CREATED', entityType: 'backup',
    entityId: result.id, description: 'Manual backup created', ...auditCtx(req),
  });
  success(res, result, 201);
}

export async function downloadBackup(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const key = decodeURIComponent(req.params.id);
  const buf = await backupsSvc.getBackupFile(sellerId, key);
  const filename = key.split('/').pop()?.replace(/\.gz$/, '') ?? 'backup.json';
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

export async function restoreBackup(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const key = decodeURIComponent(req.params.id);
  await backupsSvc.restoreBackup(sellerId, key);
  await audit.log({
    sellerId, userId: req.user!.userId, action: 'SHOP_RESTORED', entityType: 'backup',
    entityId: key, description: `Restored shop data from backup ${key}`, ...auditCtx(req),
  });
  success(res, { restored: true });
}

// Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
export async function nightlyBackupCron(_req: Request, res: Response) {
  const result = await backupsSvc.runNightlyBatch();
  res.status(200).json({ success: true, data: result, error: null });
}
