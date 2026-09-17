import { z } from 'zod';
const condition = z.enum(['good', 'fair', 'poor']);
export const createTradeInSchema = z.object({
    customerId: z.string().optional(),
    installmentId: z.string().optional(),
    cashSaleId: z.string().optional(),
    deviceName: z.string().min(1).max(200),
    brand: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    imei: z.string().max(20).optional(),
    color: z.string().max(50).optional(),
    storageGb: z.number().int().min(0).max(8192).optional(),
    condition,
    assessedValue: z.number().min(0),
    notes: z.string().max(1000).optional(),
});
export const updateTradeInSchema = z.object({
    status: z.enum(['in_stock', 'sold', 'disposed']).optional(),
    soldPrice: z.number().min(0).optional(),
    condition: condition.optional(),
    notes: z.string().max(1000).optional(),
    assessedValue: z.number().min(0).optional(),
});
