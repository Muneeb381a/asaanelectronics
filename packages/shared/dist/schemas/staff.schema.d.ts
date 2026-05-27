import { z } from 'zod';
export declare const createStaffSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    permissions: z.ZodOptional<z.ZodObject<{
        canAddCustomer: z.ZodBoolean;
        canEditCustomer: z.ZodBoolean;
        canAddInstallment: z.ZodBoolean;
        canRecordPayment: z.ZodBoolean;
        canViewReports: z.ZodBoolean;
        canManageProducts: z.ZodBoolean;
        canVerifyCustomers: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    }, {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    permissions?: {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    } | undefined;
}, {
    name: string;
    email: string;
    password: string;
    permissions?: {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    } | undefined;
}>;
export declare const updateStaffPermissionsSchema: z.ZodObject<{
    permissions: z.ZodObject<{
        canAddCustomer: z.ZodBoolean;
        canEditCustomer: z.ZodBoolean;
        canAddInstallment: z.ZodBoolean;
        canRecordPayment: z.ZodBoolean;
        canViewReports: z.ZodBoolean;
        canManageProducts: z.ZodBoolean;
        canVerifyCustomers: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    }, {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    permissions: {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    };
}, {
    permissions: {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
    };
}>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffPermissionsInput = z.infer<typeof updateStaffPermissionsSchema>;
