import { z } from 'zod';

export const paymentMethodEnum = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'] as const;

export const createPaymentSchema = z.object({
  installmentId: z.string(),
  amount: z.number().positive(),
  method: z.enum(paymentMethodEnum),
  note: z.string().optional(),
  collectedBy: z.string().optional(),
  proofImageUrl: z.string().url().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
