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
        canRecordExpense: z.ZodBoolean;
        canManageReturns: z.ZodBoolean;
        canSearchCnic: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        canMakeCashSales: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
        canRecordExpense: boolean;
        canManageReturns: boolean;
        canSearchCnic: boolean;
        canMakeCashSales: boolean;
    }, {
        canAddCustomer: boolean;
        canEditCustomer: boolean;
        canAddInstallment: boolean;
        canRecordPayment: boolean;
        canViewReports: boolean;
        canManageProducts: boolean;
        canVerifyCustomers: boolean;
        canRecordExpense: boolean;
        canManageReturns: boolean;
        canSearchCnic?: boolean | undefined;
        canMakeCashSales?: boolean | undefined;
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
        canRecordExpense: boolean;
        canManageReturns: boolean;
        canSearchCnic: boolean;
        canMakeCashSales: boolean;
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
        canRecordExpense: boolean;
        canManageReturns: boolean;
        canSearchCnic?: boolean | undefined;
        canMakeCashSales?: boolean | undefined;
    } | undefined;
}>;
export declare const updateStaffPermissionsSchema: z.ZodObject<{
    canAddCustomer: z.ZodOptional<z.ZodBoolean>;
    canEditCustomer: z.ZodOptional<z.ZodBoolean>;
    canAddInstallment: z.ZodOptional<z.ZodBoolean>;
    canRecordPayment: z.ZodOptional<z.ZodBoolean>;
    canViewReports: z.ZodOptional<z.ZodBoolean>;
    canManageProducts: z.ZodOptional<z.ZodBoolean>;
    canVerifyCustomers: z.ZodOptional<z.ZodBoolean>;
    canRecordExpense: z.ZodOptional<z.ZodBoolean>;
    canManageReturns: z.ZodOptional<z.ZodBoolean>;
    canSearchCnic: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
    canMakeCashSales: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
}, "strip", z.ZodTypeAny, {
    canAddCustomer?: boolean | undefined;
    canEditCustomer?: boolean | undefined;
    canAddInstallment?: boolean | undefined;
    canRecordPayment?: boolean | undefined;
    canViewReports?: boolean | undefined;
    canManageProducts?: boolean | undefined;
    canVerifyCustomers?: boolean | undefined;
    canRecordExpense?: boolean | undefined;
    canManageReturns?: boolean | undefined;
    canSearchCnic?: boolean | undefined;
    canMakeCashSales?: boolean | undefined;
}, {
    canAddCustomer?: boolean | undefined;
    canEditCustomer?: boolean | undefined;
    canAddInstallment?: boolean | undefined;
    canRecordPayment?: boolean | undefined;
    canViewReports?: boolean | undefined;
    canManageProducts?: boolean | undefined;
    canVerifyCustomers?: boolean | undefined;
    canRecordExpense?: boolean | undefined;
    canManageReturns?: boolean | undefined;
    canSearchCnic?: boolean | undefined;
    canMakeCashSales?: boolean | undefined;
}>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffPermissionsInput = z.infer<typeof updateStaffPermissionsSchema>;
