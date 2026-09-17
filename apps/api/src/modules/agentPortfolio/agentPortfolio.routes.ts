import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { assignCustomerSchema, addDeductionSchema, calculateDeductionsSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import {
  getPortfolio, assign, unassign,
  getDeductions, addDeduction, deleteDeduction,
  calculateDeductions, getSalarySummary,
} from './agentPortfolio.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

// Portfolio (assignments)
router.get('/',                getPortfolio);
router.post('/assign',         requireOwner, validate(assignCustomerSchema), assign);
router.patch('/:id/unassign',  requireOwner, unassign);

// Salary deductions
router.get('/deductions',              requireOwner, getDeductions);
router.post('/deductions',             requireOwner, validate(addDeductionSchema), addDeduction);
router.delete('/deductions/:id',       requireOwner, deleteDeduction);
router.post('/deductions/calculate',   requireOwner, validate(calculateDeductionsSchema), calculateDeductions);

// Salary summary
router.get('/salary-summary', requireOwner, getSalarySummary);

export default router;
