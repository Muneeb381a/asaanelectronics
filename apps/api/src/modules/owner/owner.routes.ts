import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createShopSchema, createShopOwnerSchema, toggleShopStatusSchema, rejectShopSchema, addPaymentLogSchema, shopNoteSchema, createBroadcastSchema, updateBroadcastSchema } from '@assaan/shared';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js';
import {
  listShops, createShop, createShopOwner, deleteShop, toggleShopStatus,
  approveShopTrial, rejectShopTrial, getShopAuditLogs,
  getPlatformStats,
  getShopUsage,
  listPaymentLogs, addPaymentLog, deletePaymentLog,
  addShopNote, deleteShopNote,
  listAdminAuditLogs,
  listChurnScores,
  sendRenewalReminder,
  exportShopsCSV,
  getOnboardingStatus,
  listBroadcasts, createBroadcast, updateBroadcast, deleteBroadcast,
  getShopSessions, killSession, killAllShopSessions,
} from './owner.controller.js';

const router = Router();
router.use(authenticate, requireSuperAdmin);

// ── Core shop management ──────────────────────────────────────────────────────
router.get('/shops',                  listShops);
router.get('/shops/export',           exportShopsCSV);   // must be before /shops/:id
router.post('/shops',                 validate(createShopSchema), createShop);
router.post('/shops/:id/owner',       validate(createShopOwnerSchema), createShopOwner);
router.delete('/shops/:id',           deleteShop);
router.patch('/shops/:id/status',     validate(toggleShopStatusSchema), toggleShopStatus);

// ── Trial approval (self-signup shops) ─────────────────────────────────────────
router.patch('/shops/:id/approve',    approveShopTrial);
router.patch('/shops/:id/reject',     validate(rejectShopSchema), rejectShopTrial);

// ── Shop's own internal activity log ───────────────────────────────────────────
router.get('/shops/:id/audit-logs',   getShopAuditLogs);

// ── A1: Platform stats dashboard ──────────────────────────────────────────────
router.get('/stats',                  getPlatformStats);

// ── A3: Shop drill-in usage ───────────────────────────────────────────────────
router.get('/shops/:id/usage',        getShopUsage);

// ── A4: Manual payment logs ───────────────────────────────────────────────────
router.get('/payment-logs',           listPaymentLogs);
router.post('/shops/:id/payment-logs', validate(addPaymentLogSchema), addPaymentLog);
router.delete('/payment-logs/:logId', deletePaymentLog);

// ── A7: Shop notes ────────────────────────────────────────────────────────────
router.post('/shops/:id/notes',       validate(shopNoteSchema), addShopNote);
router.delete('/shops/:id/notes/:noteId', deleteShopNote);

// ── A10: Super-admin audit log ────────────────────────────────────────────────
router.get('/admin-audit-logs',       listAdminAuditLogs);

// ── B1: Churn Risk Score ──────────────────────────────────────────────────────
router.get('/churn-scores',           listChurnScores);

// ── B2: Renewal reminder email ────────────────────────────────────────────────
router.post('/shops/:id/send-reminder', sendRenewalReminder);

// ── B5: Shop onboarding checklist ────────────────────────────────────────────
router.get('/onboarding',              getOnboardingStatus);

// ── B3: Broadcast announcements (admin CRUD) ──────────────────────────────────
router.get('/broadcasts',              listBroadcasts);
router.post('/broadcasts',             validate(createBroadcastSchema), createBroadcast);
router.patch('/broadcasts/:id',        validate(updateBroadcastSchema), updateBroadcast);
router.delete('/broadcasts/:id',       deleteBroadcast);

// ── Session management ────────────────────────────────────────────────────────
router.get('/shops/:id/sessions',              getShopSessions);
router.delete('/shops/:id/sessions',           killAllShopSessions);
router.delete('/shops/:id/sessions/:sessionId', killSession);

export default router;
