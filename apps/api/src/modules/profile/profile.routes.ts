import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { changePasswordSchema, updateProfileSchema } from '@assaan/shared';
import { getMe, updateProfile, changePassword } from './profile.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', getMe);
router.put('/', validate(updateProfileSchema), updateProfile);
router.put('/password', validate(changePasswordSchema), changePassword);

export default router;
