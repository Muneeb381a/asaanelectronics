import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createExpenseSchema } from '@assaan/shared';
import { listExpenses, getRecurringSuggestions, createExpense, updateExpense, deleteExpense } from './expenses.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',                     requirePermission('canRecordExpense'), listExpenses);
router.get('/recurring-suggestions', requirePermission('canRecordExpense'), getRecurringSuggestions);
router.post('/',      requirePermission('canRecordExpense'), validate(createExpenseSchema), createExpense);
router.patch('/:id',  requireOwner, updateExpense);
router.delete('/:id', requireOwner, deleteExpense);

export default router;
