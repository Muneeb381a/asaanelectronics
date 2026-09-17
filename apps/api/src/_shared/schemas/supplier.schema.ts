import { z } from 'zod';

export const createSupplierSchema = z.object({
  name:    z.string().min(1).max(100),
  phone:   z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  iban:    z.string().max(40).optional(),
  notes:   z.string().max(500).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// Line items carry category-specific fields (chassis, engine, colour, ...) so
// unknown keys are passed through instead of stripped.
const invoiceLineSchema = z.object({
  productId:   z.string().optional(),
  productName: z.string().min(1).max(200),
  quantity:    z.number().int().min(1).max(10000),
  unitPrice:   z.number().min(0),
  notes:       z.string().max(500).optional(),
}).passthrough();

export const createSupplierInvoiceSchema = z.object({
  totalAmount: z.number().min(0).optional(),
  paidAmount:  z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  invoiceDate: z.string().min(1).max(30),
  lines:       z.array(invoiceLineSchema).max(500).optional(),
}).passthrough();

export const updateInvoicePaidSchema = z.object({
  paidAmount: z.number().min(0),
});
