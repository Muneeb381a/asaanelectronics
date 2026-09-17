import { z } from 'zod';
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');
export const assignCustomerSchema = z.object({
    customerId: z.string().min(1),
    agentId: z.string().min(1),
    notes: z.string().max(500).optional(),
});
export const addDeductionSchema = z.object({
    staffId: z.string().min(1),
    month: monthKey,
    type: z.enum(['UNCOLLECTED', 'ADVANCE', 'DAMAGE', 'OTHER']),
    amount: z.number().positive(),
    description: z.string().min(1).max(500),
    installmentId: z.string().optional(),
    customerId: z.string().optional(),
});
export const calculateDeductionsSchema = z.object({ month: monthKey });
