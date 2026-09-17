import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createSupplierSchema, updateSupplierSchema, createSupplierInvoiceSchema, updateInvoicePaidSchema } from '@assaan/shared';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listInvoices, createInvoice, updateInvoicePaid, deleteInvoice,
} from './suppliers.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requirePermission('canManageSuppliers'));

router.get('/',    listSuppliers);
router.post('/',   validate(createSupplierSchema), createSupplier);
router.patch('/:id', validate(updateSupplierSchema), updateSupplier);
router.delete('/:id', deleteSupplier);

// Invoice sub-resource
router.get('/:supplierId/invoices',              listInvoices);
router.post('/:supplierId/invoices',             validate(createSupplierInvoiceSchema), createInvoice);
router.patch('/:supplierId/invoices/:invoiceId', validate(updateInvoicePaidSchema), updateInvoicePaid);
router.delete('/:supplierId/invoices/:invoiceId', deleteInvoice);

export default router;
