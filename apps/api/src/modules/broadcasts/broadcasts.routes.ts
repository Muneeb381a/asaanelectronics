import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getActiveBroadcasts } from './broadcasts.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', getActiveBroadcasts);

export default router;
