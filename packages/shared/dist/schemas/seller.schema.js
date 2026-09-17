import { z } from 'zod';
export const createSellerSchema = z.object({
    shopName: z.string().min(2, 'Shop name required').max(100),
    phone: z.string().min(10, 'Valid phone number required').max(15),
    address: z.string().max(500).optional(),
});
// Only shop-editable fields; plan/planExpiresAt/isActive are SUPER_ADMIN-only via billing routes.
export const updateSellerSchema = z.object({
    shopName: z.string().min(2).max(100).optional(),
    phone: z.string().min(10).max(15).optional(),
    address: z.string().max(500).optional(),
    murabahaMode: z.boolean().optional(),
    settings: z.object({
        dailyTarget: z.number().min(0).optional(),
        weeklyTarget: z.number().min(0).optional(),
        monthlyTarget: z.number().min(0).optional(),
        commissionRate: z.number().min(0).max(100).optional(),
        expenseBudgets: z.record(z.string(), z.number().min(0)).optional(),
        lateFeePerDay: z.number().min(0).optional(),
        lateFeeGraceDays: z.number().int().min(0).optional(),
        staffTargets: z.record(z.string(), z.object({ daily: z.number().min(0).optional(), monthly: z.number().min(0).optional() })).optional(),
        timezone: z.string().max(64).optional(),
    }).optional(),
}).strict();
