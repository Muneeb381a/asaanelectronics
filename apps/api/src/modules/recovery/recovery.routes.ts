import { Router } from 'express';
import { authenticate, requireOwner, requireSeller } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { createRecoverySchema } from '@assaan/shared';
import { listRecoveryActions, createRecoveryAction, deleteRecoveryAction, listPromisesDue, listAllPromises, listAgentStats, listAgentCollections } from './recovery.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

const canRecover = requirePermission(['canManageRecovery', 'canRecordPayment']);
router.get('/promises-due', canRecover, listPromisesDue);
router.get('/promises-all', canRecover, listAllPromises);
router.get('/',       canRecover, listRecoveryActions);
router.post('/',      canRecover, validate(createRecoverySchema), createRecoveryAction);
router.delete('/:id', requireOwner, deleteRecoveryAction);

// Agent performance — owner only
router.get('/agents',                     requireOwner, listAgentStats);
router.get('/agents/:userId/collections', requireOwner, listAgentCollections);

export default router;
