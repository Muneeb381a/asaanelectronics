import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createRepairJobSchema, updateRepairJobSchema, updateRepairJobStatusSchema } from '@assaan/shared';
import {
  listRepairJobs, getRepairJob, createRepairJob, updateRepairJob, updateRepairJobStatus, deleteRepairJob,
} from './repairJobs.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',     requirePermission('canMakeCashSales'), listRepairJobs);
router.get('/:id',  requirePermission('canMakeCashSales'), getRepairJob);
router.post('/',    requirePermission('canMakeCashSales'), validate(createRepairJobSchema), createRepairJob);
router.patch('/:id',         requirePermission('canMakeCashSales'), validate(updateRepairJobSchema), updateRepairJob);
router.patch('/:id/status',  requirePermission('canMakeCashSales'), validate(updateRepairJobStatusSchema), updateRepairJobStatus);
router.delete('/:id', requireOwner, deleteRepairJob);

export default router;
