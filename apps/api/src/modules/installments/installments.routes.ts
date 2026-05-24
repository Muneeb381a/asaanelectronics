import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createInstallmentSchema } from '@assaan/shared';
import {
  listInstallments, getInstallment, createInstallment, defaultInstallment,
  cancelInstallment, rescheduleInstallment, deleteInstallment,
  approveInstallment, closeInstallment,
} from './installments.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/',           listInstallments);
router.get('/:id',        getInstallment);
router.post('/',          requirePermission('canAddInstallment'), validate(createInstallmentSchema), createInstallment);
router.patch('/:id/approve',    requireOwner, approveInstallment);
router.patch('/:id/close',      requireOwner, closeInstallment);
router.patch('/:id/default',    requireOwner, defaultInstallment);
router.patch('/:id/cancel',     requireOwner, cancelInstallment);
router.patch('/:id/reschedule', requireOwner, rescheduleInstallment);
router.delete('/:id',           requireOwner, deleteInstallment);

export default router;
