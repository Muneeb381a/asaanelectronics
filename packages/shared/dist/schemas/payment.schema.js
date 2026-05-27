import { z } from 'zod';
export const paymentMethodEnum = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];
export const createPaymentSchema = z.object({
    installmentId: z.string(),
    amount: z.number().positive(),
    method: z.enum(paymentMethodEnum),
    note: z.string().optional(),
});
