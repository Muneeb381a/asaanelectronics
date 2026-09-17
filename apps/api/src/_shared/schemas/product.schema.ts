import { z } from 'zod';

export const createProductSchema = z.object({
  name:             z.string().min(1).max(200),
  category:         z.string().max(100).optional(),
  brand:            z.string().max(100).optional(),
  model:            z.string().max(100).optional(),
  color:            z.string().max(50).optional(),
  price:            z.number().positive(),
  installmentPrice: z.number().positive().optional(),
  purchasePrice:    z.number().positive().optional(),
  stock:            z.number().int().min(0).default(0),
  minStock:         z.number().int().min(0).optional(),
  photoUrl:         z.string().url().optional().or(z.literal('')),
  serial:           z.string().max(100).optional(),
  warrantyMonths:   z.number().int().min(0).optional(),
  description:      z.string().max(1000).optional(),
  supplierId:       z.string().optional(),
  engineNumber:       z.string().max(50).optional(),
  chassisNumber:      z.string().max(50).optional(),
  registrationNumber: z.string().max(50).optional(),
  vehicleCondition:   z.enum(['NEW', 'USED']).optional(),
  modelYear:          z.number().int().min(1970).max(2030).optional(),
  letterStatus:        z.enum(['NONE', 'FIRST_NOTICE', 'SECOND_NOTICE', 'LEGAL_NOTICE', 'FILED']).optional(),
  biometricStatus:     z.enum(['PENDING', 'SELLER_DONE', 'BUYER_DONE', 'COMPLETED', 'NOT_REQUIRED']).optional(),
  vehicleFileLocation: z.enum(['WITH_SHOP', 'WITH_CUSTOMER', 'WITH_RTO', 'WITH_NADRA', 'IN_TRANSFER', 'WITH_COURT', 'WITH_POLICE']).optional(),
  attributes:          z.record(z.string(), z.unknown()).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Units carry category-specific fields (imei, chassis, ram, ...) so unknown keys pass through.
const bulkReceiveUnitSchema = z.object({
  name:             z.string().min(1).max(200),
  price:            z.number().positive(),
  purchasePrice:    z.number().min(0).optional(),
  installmentPrice: z.number().min(0).optional(),
  stock:            z.number().int().min(0).max(100000).optional(),
  minStock:         z.number().int().min(0).optional(),
}).passthrough();

export const bulkReceiveProductsSchema = z.object({
  supplierId:    z.string().optional(),
  invoiceDate:   z.string().max(30).optional(),
  paidAmount:    z.number().min(0).optional(),
  invoiceNumber: z.string().max(50).optional(),
  paymentMethod: z.enum(['CASH', 'BANK', 'CHEQUE', 'CREDIT']).optional(),
  dueDate:       z.string().max(30).optional(),
  units:         z.array(bulkReceiveUnitSchema).min(1).max(500),
});
