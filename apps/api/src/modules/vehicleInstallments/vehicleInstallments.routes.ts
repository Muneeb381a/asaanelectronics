import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import {
  listVehicleInstallments, getVehicleInstallmentStats, getVehicleInstallment,
  createVehicleInstallment, recordVehiclePayment,
  defaultVehicleInstallment, cancelVehicleInstallment,
  deleteVehicleInstallment, deleteVehiclePayment,
  updateVehicleInstallmentFields,
} from './vehicleInstallments.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/stats',              getVehicleInstallmentStats);
router.get('/',                   listVehicleInstallments);
router.get('/:id',                getVehicleInstallment);
router.post('/',                  requirePermission('canAddInstallment'), createVehicleInstallment);
router.post('/:id/payment',       requirePermission('canRecordPayment'),  recordVehiclePayment);
router.patch('/:id/fields',       requirePermission('canRecordPayment'), updateVehicleInstallmentFields);
router.patch('/:id/default',      requireOwner, defaultVehicleInstallment);
router.patch('/:id/cancel',       requireOwner, cancelVehicleInstallment);
router.delete('/:id',             requireOwner, deleteVehicleInstallment);
router.delete('/:id/payment/:paymentId', requireOwner, deleteVehiclePayment);

export default router;
