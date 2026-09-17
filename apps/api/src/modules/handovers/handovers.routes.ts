import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createHandoverSchema, directReceiveHandoverSchema, confirmHandoverSchema, disputeHandoverSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import {
  listHandovers, getCollectedToday, createHandover,
  confirmHandover, disputeHandover, reopenHandover,
  getPendingBalances, getMyBalance,
  directReceiveHandover,
} from './handovers.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

// ── Read endpoints ────────────────────────────────────────────────────────────
router.get('/',                    listHandovers);
router.get('/collected-today',     getCollectedToday);
router.get('/pending-balances',    requireOwner, getPendingBalances);  // all staff balances
router.get('/my-balance',          getMyBalance);                       // own balance (staff or owner)

// ── Staff actions ─────────────────────────────────────────────────────────────
router.post('/',                   validate(createHandoverSchema), createHandover);                    // staff submits handover

// ── Owner-only actions ────────────────────────────────────────────────────────
router.post('/direct-receive',     requireOwner, validate(directReceiveHandoverSchema), directReceiveHandover); // owner-initiated, no staff submit needed
router.patch('/:id/confirm',       requireOwner, validate(confirmHandoverSchema), confirmHandover);
router.patch('/:id/dispute',       requireOwner, validate(disputeHandoverSchema), disputeHandover);
router.patch('/:id/reopen',        requireOwner, reopenHandover);        // DISPUTED → PENDING

export default router;
