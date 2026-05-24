import { Router } from 'express';
import { authenticate, requireOwner, requireSeller } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createRecoverySchema } from '@assaan/shared';
import { listRecoveryActions, createRecoveryAction, deleteRecoveryAction } from './recovery.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',       listRecoveryActions);
router.post('/',      validate(createRecoverySchema), createRecoveryAction);
router.delete('/:id', requireOwner, deleteRecoveryAction);

export default router;
