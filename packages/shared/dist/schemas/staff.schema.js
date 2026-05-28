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
});
export const createStaffSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(6),
    permissions: permissionsSchema.optional(),
});
export const updateStaffPermissionsSchema = permissionsSchema.partial();
