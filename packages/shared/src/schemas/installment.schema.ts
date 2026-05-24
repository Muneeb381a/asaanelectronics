import { z } from 'zod';

export const createInstallmentSchema = z.object({
  customerId: z.string(),
  productId: z.string(),
  totalAmount: z.number().positive(),
  downPayment: z.number().min(0),
  months: z.number().int().min(1).max(60),
  startDate: z.string().datetime(),
});

export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;
