import { z } from 'zod';
export const createHandoverSchema = z.object({
    handedAmount: z.number().positive(),
    note: z.string().max(300).optional(),
    handoverDate: z.string().max(30).optional(),
});
export const directReceiveHandoverSchema = z.object({
    staffId: z.string().min(1),
    amount: z.number().positive(),
    note: z.string().max(300).optional(),
});
export const confirmHandoverSchema = z.object({
    confirmedAmount: z.number().positive(),
    ownerNote: z.string().max(500).optional(),
});
export const disputeHandoverSchema = z.object({
    ownerNote: z.string().max(500).optional(),
});
