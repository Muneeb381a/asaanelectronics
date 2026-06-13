import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createPaymentSchema } from '@assaan/shared';
import { listPayments, recordPayment, deletePayment, patchPayment } from './payments.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/',       listPayments);
router.post('/',      requirePermission('canRecordPayment'), validate(createPaymentSchema), recordPayment);
router.patch('/:id',  requireOwner, patchPayment);
router.delete('/:id', requireOwner, deletePayment);

export default router;
