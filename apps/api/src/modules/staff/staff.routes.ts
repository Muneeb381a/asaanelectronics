import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createStaffSchema, updateStaffPermissionsSchema } from '@assaan/shared';
import { listStaff, createStaff, updatePermissions, removeStaff } from './staff.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/', listStaff);
router.post('/', requireOwner, validate(createStaffSchema), createStaff);
router.patch('/:id/permissions', requireOwner, validate(updateStaffPermissionsSchema), updatePermissions);
router.delete('/:id', requireOwner, removeStaff);

export default router;
