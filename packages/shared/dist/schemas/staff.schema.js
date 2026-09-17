import { z } from 'zod';
const permissionsSchema = z.object({
    canAddCustomer: z.boolean(),
    canEditCustomer: z.boolean(),
    canAddInstallment: z.boolean(),
    canRecordPayment: z.boolean(),
    canViewReports: z.boolean(),
    canManageProducts: z.boolean(),
    canVerifyCustomers: z.boolean(),
    canRecordExpense: z.boolean(),
    canManageReturns: z.boolean(),
    canSearchCnic: z.boolean().optional().default(false),
    canMakeCashSales: z.boolean().optional().default(false),
});
export const createStaffSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(255),
    password: z.string().min(6).max(128),
    permissions: permissionsSchema.optional(),
});
export const updateStaffPermissionsSchema = permissionsSchema.partial();
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');
export const updateStaffProfileSchema = z.object({
    commissionRate: z.number().min(0).max(100).nullable().optional(),
    monthlySalary: z.number().min(0).nullable().optional(),
});
export const freezeStaffSchema = z.object({
    durationMonths: z.union([z.number().int().min(1).max(120), z.literal('permanent')]),
});
export const staffPaySchema = z.object({
    staffId: z.string().min(1),
    month: monthKey,
    amount: z.number().positive(),
    note: z.string().max(500).optional(),
});
export const staffTargetSchema = z.object({
    daily: z.number().min(0).optional(),
    monthly: z.number().min(0).optional(),
});
