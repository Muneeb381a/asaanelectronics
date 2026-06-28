import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createPaymentSchema } from '@assaan/shared';
import {
  listPayments, recordPayment, deletePayment, patchPayment, recordBulkPayments,
  generateJazzCashLink, jazzCashPayPage, jazzCashCallback, jazzCashStatus,
} from './payments.controller.js';

const router = Router();

// ── Public JazzCash endpoints (no auth — called by JazzCash servers / customers) ──
router.get('/jazzcash-pay/:txnRefNo',  jazzCashPayPage);
router.post('/jazzcash-callback',       jazzCashCallback);

router.use(authenticate, requireSeller);

router.get('/',       listPayments);
router.get('/jazzcash-status',  jazzCashStatus);
router.post('/jazzcash-link',   requireOwner, generateJazzCashLink);
router.post('/',      requirePermission('canRecordPayment'), validate(createPaymentSchema), recordPayment);
router.post('/bulk',  requirePermission('canRecordPayment'), recordBulkPayments);
router.patch('/:id',  requireOwner, patchPayment);
router.delete('/:id', requireOwner, deletePayment);

export default router;
