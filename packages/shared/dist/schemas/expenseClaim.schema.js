import { z } from 'zod';
export const createExpenseClaimSchema = z.object({
    category: z.enum(['RENT', 'SALARY', 'UTILITY', 'PURCHASE', 'MAINTENANCE', 'TRANSPORT', 'OTHER']),
    amount: z.number().positive(),
    description: z.string().max(300).optional(),
    claimDate: z.string().max(30).optional(),
    receiptImageUrl: z.string().max(500).optional(),
});
export const approveExpenseClaimSchema = z.object({
    approvedAmount: z.number().positive().optional(),
    ownerNote: z.string().max(500).optional(),
});
export const rejectExpenseClaimSchema = z.object({
    ownerNote: z.string().max(500).optional(),
});
