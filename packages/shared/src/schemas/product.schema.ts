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
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
