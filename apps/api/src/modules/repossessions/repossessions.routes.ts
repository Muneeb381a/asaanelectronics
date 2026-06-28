import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import {
  listRepossessions, getRepossessionStats, createRepossession,
  updateRepossession, removeRepossession,
} from './repossessions.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/stats', getRepossessionStats);
router.get('/',      listRepossessions);
router.post('/',     createRepossession);
router.patch('/:id', updateRepossession);
router.delete('/:id', removeRepossession);

export default router;
