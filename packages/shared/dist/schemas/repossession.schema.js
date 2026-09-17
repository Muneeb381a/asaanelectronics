import { z } from 'zod';
const condition = z.enum(['good', 'fair', 'poor']);
export const createRepossessionSchema = z.object({
    installmentId: z.string().min(1),
    repossessedDate: z.string().min(1).max(30),
    deviceName: z.string().min(1).max(200),
    imei: z.string().max(20).optional(),
    condition,
    reason: z.string().max(500).optional(),
    amountRecovered: z.number().min(0).optional(),
    assessedValue: z.number().min(0).optional(),
    notes: z.string().max(1000).optional(),
});
export const updateRepossessionSchema = z.object({
    status: z.enum(['in_stock', 'sold', 'disposed', 'returned']).optional(),
    soldPrice: z.number().min(0).optional(),
    condition: condition.optional(),
    notes: z.string().max(1000).optional(),
    assessedValue: z.number().min(0).optional(),
});
