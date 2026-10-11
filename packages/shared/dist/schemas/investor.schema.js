import { z } from 'zod';
export const createInvestorSchema = z.object({
    name: z.string().min(1).max(100),
    phone: z.string().max(20).optional(),
    cnic: z.string().max(20).optional(),
    profitSharePercent: z.number().min(0).max(100),
    notes: z.string().max(500).optional(),
});
export const updateInvestorSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).nullable().optional(),
    cnic: z.string().max(20).nullable().optional(),
    profitSharePercent: z.number().min(0).max(100).optional(),
    notes: z.string().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
});
export const addContributionSchema = z.object({
    amount: z.number().positive(),
    contributedOn: z.string().min(1),
    note: z.string().max(300).optional(),
});
export const recordInvestorPayoutSchema = z.object({
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
    method: z.enum(['MANUAL', 'AUTO']),
    calculatedShare: z.number().min(0).optional(),
    amount: z.number().positive(),
    note: z.string().max(300).optional(),
    paidOn: z.string().min(1),
});
