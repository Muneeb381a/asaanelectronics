import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createInstallmentSchema, installmentReasonSchema, rescheduleInstallmentSchema, waiverInstallmentSchema, pauseInstallmentSchema, transferInstallmentSchema, installmentFieldsSchema } from '@assaan/shared';
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

const canCollect = requirePermission(['canRecordPayment', 'canManageRecovery']);
router.get('/due-sheet',            canCollect, getDueSheet);
router.get('/collection-schedule', canCollect, getCollectionSchedule);
router.get('/overdue-stage',        canCollect, listOverdueWithStage);
router.get('/',                listInstallments);
router.get('/:id',            getInstallment);
router.get('/:id/settlement', getSettlement);
router.post('/',          requirePermission('canAddInstallment'), validate(createInstallmentSchema), createInstallment);
router.post('/import',    requireOwner, importInstallments);
router.patch('/:id',      requireOwner, updateInstallment);
router.patch('/:id/approve',    requireOwner, approveInstallment);
router.patch('/:id/close',      requireOwner, closeInstallment);
router.patch('/:id/default',    requireOwner, validate(installmentReasonSchema), defaultInstallment);
router.patch('/:id/cancel',     requireOwner, validate(installmentReasonSchema), cancelInstallment);
router.patch('/:id/reschedule', requireOwner, validate(rescheduleInstallmentSchema), rescheduleInstallment);
router.patch('/:id/waiver',     requireOwner, validate(waiverInstallmentSchema), waiverInstallment);
router.patch('/:id/pause',      requireOwner, validate(pauseInstallmentSchema), pauseInstallment);
router.patch('/:id/transfer',   requireOwner, validate(transferInstallmentSchema), transferInstallment);
router.patch('/:id/fields',     requirePermission('canRecordPayment'), validate(installmentFieldsSchema), updateInstallmentFields);
router.delete('/:id/pause',     requireOwner, unpauseInstallment);
router.delete('/:id',           requireOwner, deleteInstallment);

export default router;
