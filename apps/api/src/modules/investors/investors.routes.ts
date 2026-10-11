import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createInvestorSchema, updateInvestorSchema, addContributionSchema, recordInvestorPayoutSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import {
  listInvestors, createInvestor, updateInvestor, deleteInvestor, getInvestorLedger,
  addContribution, removeContribution, recordPayout, removePayout,
} from './investors.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/',    listInvestors);
router.post('/',   validate(createInvestorSchema), createInvestor);
router.patch('/:id', validate(updateInvestorSchema), updateInvestor);
router.delete('/:id', deleteInvestor);

router.get('/:id/ledger', getInvestorLedger);

router.post('/:id/contributions',               validate(addContributionSchema), addContribution);
router.delete('/:id/contributions/:contribId',   removeContribution);

router.post('/:id/payouts',               validate(recordInvestorPayoutSchema), recordPayout);
router.delete('/:id/payouts/:payoutId',   removePayout);

export default router;
