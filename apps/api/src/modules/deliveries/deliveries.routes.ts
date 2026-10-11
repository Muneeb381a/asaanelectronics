import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createDeliverySchema, markDeliveredSchema, markRejectedSchema } from '@assaan/shared';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import {
  listDeliveries, listDrivers, createDelivery, dispatchDelivery,
  markDeliveredDelivery, markRejectedDelivery, markStockReversedDelivery, cancelDelivery,
} from './deliveries.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requirePermission('canManageDeliveries'));

router.get('/',        listDeliveries);
router.get('/drivers', listDrivers);
router.post('/',       validate(createDeliverySchema), createDelivery);

router.patch('/:id/dispatch',       dispatchDelivery);
router.patch('/:id/delivered',      validate(markDeliveredSchema), markDeliveredDelivery);
router.patch('/:id/rejected',       validate(markRejectedSchema), markRejectedDelivery);
router.patch('/:id/stock-reversed', markStockReversedDelivery);
router.patch('/:id/cancel',         cancelDelivery);

export default router;
