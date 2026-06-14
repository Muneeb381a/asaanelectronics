import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { submitVerificationSchema, ownerVerifySchema } from '@assaan/shared';
import { myQueue, submitVerification, getReport, avoStats, reVerifyCustomer, ownerVerifyCustomer } from './verifications.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/my-queue',                   myQueue);
router.post('/customers/:id',             validate(submitVerificationSchema), submitVerification);
router.get('/customers/:id/report',       getReport);
router.post('/customers/:id/re-verify',      requireOwner, reVerifyCustomer);
router.post('/customers/:id/owner-verify',   requireOwner, validate(ownerVerifySchema), ownerVerifyCustomer);
router.get('/avo-stats',                     requireOwner, avoStats);

export default router;
