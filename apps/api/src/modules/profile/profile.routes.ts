import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getMe, updateProfile, changePassword } from './profile.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', getMe);
router.put('/', updateProfile);
router.put('/password', changePassword);

export default router;
