import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createTradeInSchema, updateTradeInSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { listTradeIns, getTradeInStats, createTradeIn, updateTradeIn, removeTradeIn } from './tradeIns.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/stats', getTradeInStats);
router.get('/',      listTradeIns);
router.post('/',     validate(createTradeInSchema), createTradeIn);
router.patch('/:id', validate(updateTradeInSchema), updateTradeIn);
router.delete('/:id', removeTradeIn);

export default router;
