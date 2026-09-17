import { z } from 'zod';

export const paymentMethodEnum = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'] as const;

export const createPaymentSchema = z.object({
  installmentId: z.string(),
  amount: z.number().positive(),
  method: z.enum(paymentMethodEnum),
  note: z.string().max(500).optional(),
  collectedBy: z.string().optional(),
  proofImageUrl: z.string().url().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  method: z.enum(paymentMethodEnum).optional(),
  note: z.string().max(500).optional(),
}).refine((b) => b.amount !== undefined || b.method !== undefined || b.note !== undefined, {
  message: 'No fields to update',
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

export const bulkPaymentsSchema = z.object({
  entries: z.array(createPaymentSchema).min(1).max(100),
});

export const jazzCashLinkSchema = z.object({
  installmentId: z.string().min(1),
  amount:        z.number().positive(),
  customerName:  z.string().min(1).max(100),
  customerPhone: z.string().max(20).optional().default(''),
  description:   z.string().max(200).optional(),
});
