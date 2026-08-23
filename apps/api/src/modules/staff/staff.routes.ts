import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createStaffSchema, updateStaffPermissionsSchema } from '@assaan/shared';
import {
  listStaff, createStaff, updatePermissions, updateProfile, removeStaff, freezeStaff, unfreezeStaff,
  getCommissions, payCommission, deleteCommissionPayment,
  listSalaries, paySalary, deleteSalaryPayment,
  getBriefing, setStaffTarget,
  getCollections,
} from './staff.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

// Staff CRUD
router.get('/',    listStaff);
router.post('/',   requireOwner, validate(createStaffSchema), createStaff);
router.patch('/:id/permissions', requireOwner, validate(updateStaffPermissionsSchema), updatePermissions);
router.patch('/:id/profile',     requireOwner, updateProfile);
router.patch('/:id/freeze',      requireOwner, freezeStaff);
router.patch('/:id/unfreeze',    requireOwner, unfreezeStaff);
router.delete('/:id',            requireOwner, removeStaff);

// Commission
router.get('/commissions',         requireOwner, getCommissions);
router.post('/commissions/pay',    requireOwner, payCommission);
router.delete('/commissions/pay',  requireOwner, deleteCommissionPayment);

// Salary
router.get('/salaries',         requireOwner, listSalaries);
router.post('/salaries/pay',    requireOwner, paySalary);
router.delete('/salaries/pay',  requireOwner, deleteSalaryPayment);

// Daily briefing + targets
router.get('/briefing',           requireOwner, getBriefing);
router.patch('/:id/target',       requireOwner, setStaffTarget);

// Collections report
router.get('/collections',      requireOwner, getCollections);

export default router;
