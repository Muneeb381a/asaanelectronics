import { z } from 'zod';
export const createExpenseSchema = z.object({
    category: z.enum(['RENT', 'SALARY', 'UTILITY', 'PURCHASE', 'MAINTENANCE', 'TRANSPORT', 'OTHER']),
    amount: z.number().positive(),
    description: z.string().max(200).optional(),
    date: z.string().optional(),
    isRecurring: z.boolean().optional(),
    recurrenceDay: z.number().int().min(1).max(31).optional(),
});
export const updateExpenseSchema = createExpenseSchema.partial()
    .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'No fields to update' });
