import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createExpenseSchema } from '@assaan/shared';
import { listExpenses, getRecurringSuggestions, createExpense, updateExpense, deleteExpense } from './expenses.controller.js';
import { listPeriods, lockPeriod, unlockPeriod } from './financial-periods.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

// Period lock routes (specific, must come before /:id wildcards)
router.get('/periods',                 requireOwner, listPeriods);
router.post('/periods/:year/:month',   requireOwner, lockPeriod);
router.delete('/periods/:year/:month', requireOwner, unlockPeriod);

router.get('/',                      requirePermission('canRecordExpense'), listExpenses);
router.get('/recurring-suggestions', requirePermission('canRecordExpense'), getRecurringSuggestions);
router.post('/',      requirePermission('canRecordExpense'), validate(createExpenseSchema), createExpense);
router.patch('/:id',  requireOwner, updateExpense);
router.delete('/:id', requireOwner, deleteExpense);

export default router;
