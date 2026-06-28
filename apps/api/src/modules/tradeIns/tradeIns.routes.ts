import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { listTradeIns, getTradeInStats, createTradeIn, updateTradeIn, removeTradeIn } from './tradeIns.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/stats', getTradeInStats);
router.get('/',      listTradeIns);
router.post('/',     createTradeIn);
router.patch('/:id', updateTradeIn);
router.delete('/:id', removeTradeIn);

export default router;
