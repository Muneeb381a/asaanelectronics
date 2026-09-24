import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createSupplierSchema, updateSupplierSchema, createSupplierInvoiceSchema, recordSupplierPaymentSchema } from '@assaan/shared';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listInvoices, createInvoice, deleteInvoice,
  listPayments, recordPayment, removePayment,
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
router.delete('/:supplierId/invoices/:invoiceId', deleteInvoice);

// Payments — recorded one at a time against an invoice; paidAmount on the invoice
// is a running total kept in sync inside the same transaction (see suppliers.service.ts).
router.get('/:supplierId/invoices/:invoiceId/payments',              listPayments);
router.post('/:supplierId/invoices/:invoiceId/payments',             validate(recordSupplierPaymentSchema), recordPayment);
router.delete('/:supplierId/invoices/:invoiceId/payments/:paymentId', removePayment);

export default router;
