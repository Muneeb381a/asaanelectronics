import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createInstallmentSchema } from '@assaan/shared';
import {
  listInstallments, getInstallment, createInstallment, defaultInstallment,
  cancelInstallment, rescheduleInstallment, deleteInstallment,
  approveInstallment, closeInstallment, importInstallments, updateInstallment,
  getDueSheet, getCollectionSchedule, waiverInstallment, getSettlement,
  pauseInstallment, unpauseInstallment,
  listOverdueWithStage, transferInstallment, updateInstallmentFields,
} from './installments.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/due-sheet',            getDueSheet);
router.get('/collection-schedule', getCollectionSchedule);
router.get('/overdue-stage',        listOverdueWithStage);
router.get('/',                listInstallments);
router.get('/:id',            getInstallment);
router.get('/:id/settlement', getSettlement);
router.post('/',          requirePermission('canAddInstallment'), validate(createInstallmentSchema), createInstallment);
router.post('/import',    requireOwner, importInstallments);
router.patch('/:id',      requireOwner, updateInstallment);
router.patch('/:id/approve',    requireOwner, approveInstallment);
router.patch('/:id/close',      requireOwner, closeInstallment);
router.patch('/:id/default',    requireOwner, defaultInstallment);
router.patch('/:id/cancel',     requireOwner, cancelInstallment);
router.patch('/:id/reschedule', requireOwner, rescheduleInstallment);
router.patch('/:id/waiver',     requireOwner, waiverInstallment);
router.patch('/:id/pause',      requireOwner, pauseInstallment);
router.patch('/:id/transfer',   requireOwner, transferInstallment);
router.patch('/:id/fields',     requirePermission('canRecordPayment'), updateInstallmentFields);
router.delete('/:id/pause',     requireOwner, unpauseInstallment);
router.delete('/:id',           requireOwner, deleteInstallment);

export default router;
