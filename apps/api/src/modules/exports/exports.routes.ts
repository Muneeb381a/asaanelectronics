import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { getFullBackup } from './exports.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/backup', requireOwner, getFullBackup);

export default router;
