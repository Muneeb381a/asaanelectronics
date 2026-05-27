import { z } from 'zod';

export const createExpenseSchema = z.object({
  category: z.enum(['RENT', 'SALARY', 'UTILITY', 'PURCHASE', 'MAINTENANCE', 'TRANSPORT', 'OTHER']),
  amount: z.number().positive(),
  description: z.string().max(200).optional(),
  date: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
