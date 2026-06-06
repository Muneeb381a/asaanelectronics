import { z } from 'zod';
export const createCashSaleSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(999),
    amount: z.number().positive(),
    method: z.enum(['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER']),
    customerName: z.string().max(100).optional(),
    customerPhone: z.string().max(20).optional(),
    imeiNumber: z.string().max(20).optional(),
    note: z.string().max(200).optional(),
});
