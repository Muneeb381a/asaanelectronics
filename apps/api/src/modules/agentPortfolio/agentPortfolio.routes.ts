import { Router } from 'express';
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
router.post('/assign',         requireOwner, assign);
router.patch('/:id/unassign',  requireOwner, unassign);

// Salary deductions
router.get('/deductions',              requireOwner, getDeductions);
router.post('/deductions',             requireOwner, addDeduction);
router.delete('/deductions/:id',       requireOwner, deleteDeduction);
router.post('/deductions/calculate',   requireOwner, calculateDeductions);

// Salary summary
router.get('/salary-summary', requireOwner, getSalarySummary);

export default router;
