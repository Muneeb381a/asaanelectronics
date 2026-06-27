import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createStaffSchema, updateStaffPermissionsSchema } from '@assaan/shared';
import { listStaff, createStaff, updatePermissions, removeStaff, freezeStaff, unfreezeStaff, getCommissions } from './staff.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/', listStaff);
router.get('/commissions', requireOwner, getCommissions);
router.post('/', requireOwner, validate(createStaffSchema), createStaff);
router.patch('/:id/permissions', requireOwner, validate(updateStaffPermissionsSchema), updatePermissions);
router.patch('/:id/freeze',      requireOwner, freezeStaff);
router.patch('/:id/unfreeze',    requireOwner, unfreezeStaff);
router.delete('/:id', requireOwner, removeStaff);

export default router;
