import { z } from 'zod';

export const createReturnSchema = z.object({
  customerId:    z.string().min(1),
  productId:     z.string().min(1),
  installmentId: z.string().optional(),
  type:          z.enum(['RETURN', 'EXCHANGE', 'WARRANTY_REPLACEMENT']),
  reason:        z.enum(['DEFECTIVE', 'DAMAGED_IN_USE', 'WRONG_ITEM', 'CUSTOMER_REQUEST', 'WARRANTY_CLAIM', 'OTHER']),
  condition:     z.enum(['GOOD', 'DAMAGED', 'UNUSABLE']),
  notes:         z.string().max(1000).optional(),
});

export const resolveReturnSchema = z.object({
  status:               z.enum(['APPROVED', 'REJECTED']),
  resolutionType:       z.enum(['RESALE', 'DAMAGED_WRITE_OFF', 'REPLACEMENT_SENT']).optional(),
  replacementProductId: z.string().optional(),
  refundAmount:         z.number().min(0).optional(),
  notes:                z.string().max(1000).optional(),
});
