import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createExpenseSchema } from '@assaan/shared';
import { listExpenses, createExpense, deleteExpense } from './expenses.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/',       listExpenses);
router.post('/',      validate(createExpenseSchema), createExpense);
router.delete('/:id', deleteExpense);

export default router;
