import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createCustomerSchema, updateCustomerSchema } from '@assaan/shared';
import {
  listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, assignAvo,
  getLifecycleCounts, getRiskBreakdown, lookupByCnic,
} from './customers.controller.js';
import { listNotes, addNote, deleteNote } from './customer-notes.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/lifecycle-counts', getLifecycleCounts);
router.get('/lookup',           requirePermission(['canSearchCnic', 'canAddInstallment', 'canAddCustomer']), lookupByCnic);
router.get('/',                 listCustomers);
router.get('/:id',              getCustomer);
router.get('/:id/risk-breakdown', getRiskBreakdown);
router.post('/',      requirePermission('canAddCustomer'),  validate(createCustomerSchema), createCustomer);
router.patch('/:id',  requirePermission('canEditCustomer'), validate(updateCustomerSchema), updateCustomer);
router.patch('/:id/assign-avo', requireOwner, assignAvo);
router.delete('/:id', requireOwner, deleteCustomer);

router.get('/:customerId/notes',            listNotes);
router.post('/:customerId/notes',           requirePermission('canAddCustomer'), addNote);
router.delete('/:customerId/notes/:noteId', requireOwner, deleteNote);

export default router;
