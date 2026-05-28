import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createExpenseSchema } from '@assaan/shared';
import { listExpenses, createExpense, deleteExpense } from './expenses.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',       requirePermission('canRecordExpense'), listExpenses);
router.post('/',      requirePermission('canRecordExpense'), validate(createExpenseSchema), createExpense);
router.delete('/:id', requireOwner, deleteExpense);

export default router;
