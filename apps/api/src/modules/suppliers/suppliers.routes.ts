import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listInvoices, createInvoice, updateInvoicePaid, deleteInvoice,
} from './suppliers.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/',    listSuppliers);
router.post('/',   createSupplier);
router.patch('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

// Invoice sub-resource
router.get('/:supplierId/invoices',              listInvoices);
router.post('/:supplierId/invoices',             createInvoice);
router.patch('/:supplierId/invoices/:invoiceId', updateInvoicePaid);
router.delete('/:supplierId/invoices/:invoiceId', deleteInvoice);

export default router;
