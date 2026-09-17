import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createRepossessionSchema, updateRepossessionSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import {
  listRepossessions, getRepossessionStats, createRepossession,
  updateRepossession, removeRepossession,
} from './repossessions.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/stats', getRepossessionStats);
router.get('/',      listRepossessions);
router.post('/',     validate(createRepossessionSchema), createRepossession);
router.patch('/:id', validate(updateRepossessionSchema), updateRepossession);
router.delete('/:id', removeRepossession);

export default router;
