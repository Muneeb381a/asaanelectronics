import { Router } from 'express';
import { authenticate, requireOwner, requireSeller } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createRecoverySchema } from '@assaan/shared';
import { listRecoveryActions, createRecoveryAction, deleteRecoveryAction, listPromisesDue, listAgentStats, listAgentCollections } from './recovery.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/promises-due', listPromisesDue);
router.get('/',       listRecoveryActions);
router.post('/',      validate(createRecoverySchema), createRecoveryAction);
router.delete('/:id', requireOwner, deleteRecoveryAction);

// Agent performance — owner only
router.get('/agents',                     requireOwner, listAgentStats);
router.get('/agents/:userId/collections', requireOwner, listAgentCollections);

export default router;
