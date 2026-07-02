import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js';
import {
  listShops, createShop, createShopOwner, deleteShop, toggleShopStatus,
  getPlatformStats,
  getShopUsage,
  listPaymentLogs, addPaymentLog, deletePaymentLog,
  addShopNote, deleteShopNote,
} from './owner.controller.js';

const router = Router();
router.use(authenticate, requireSuperAdmin);

// ── Core shop management ──────────────────────────────────────────────────────
router.get('/shops',                  listShops);
router.post('/shops',                 createShop);
router.post('/shops/:id/owner',       createShopOwner);
router.delete('/shops/:id',           deleteShop);
router.patch('/shops/:id/status',     toggleShopStatus);

// ── A1: Platform stats dashboard ──────────────────────────────────────────────
router.get('/stats',                  getPlatformStats);

// ── A3: Shop drill-in usage ───────────────────────────────────────────────────
router.get('/shops/:id/usage',        getShopUsage);

// ── A4: Manual payment logs ───────────────────────────────────────────────────
router.get('/payment-logs',           listPaymentLogs);
router.post('/shops/:id/payment-logs', addPaymentLog);
router.delete('/payment-logs/:logId', deletePaymentLog);

// ── A7: Shop notes ────────────────────────────────────────────────────────────
router.post('/shops/:id/notes',       addShopNote);
router.delete('/shops/:id/notes/:noteId', deleteShopNote);

export default router;
