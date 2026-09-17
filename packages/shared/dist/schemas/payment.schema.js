import { z } from 'zod';
export const paymentMethodEnum = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];
export const createPaymentSchema = z.object({
    installmentId: z.string(),
    amount: z.number().positive(),
    method: z.enum(paymentMethodEnum),
    note: z.string().max(500).optional(),
    collectedBy: z.string().optional(),
    proofImageUrl: z.string().url().optional(),
});
export const updatePaymentSchema = z.object({
    amount: z.number().positive().optional(),
    method: z.enum(paymentMethodEnum).optional(),
    note: z.string().max(500).optional(),
}).refine((b) => b.amount !== undefined || b.method !== undefined || b.note !== undefined, {
    message: 'No fields to update',
});
