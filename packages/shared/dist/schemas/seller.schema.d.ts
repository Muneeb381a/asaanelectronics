import { z } from 'zod';
export declare const createSellerSchema: z.ZodObject<{
    shopName: z.ZodString;
    phone: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    shopName: string;
    phone: string;
    address?: string | undefined;
}, {
    shopName: string;
    phone: string;
    address?: string | undefined;
}>;
export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export declare const updateSellerSchema: z.ZodObject<{
    shopName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    murabahaMode: z.ZodOptional<z.ZodBoolean>;
    settings: z.ZodOptional<z.ZodObject<{
        dailyTarget: z.ZodOptional<z.ZodNumber>;
        weeklyTarget: z.ZodOptional<z.ZodNumber>;
        monthlyTarget: z.ZodOptional<z.ZodNumber>;
        commissionRate: z.ZodOptional<z.ZodNumber>;
        expenseBudgets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        lateFeePerDay: z.ZodOptional<z.ZodNumber>;
        lateFeeGraceDays: z.ZodOptional<z.ZodNumber>;
        staffTargets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            daily: z.ZodOptional<z.ZodNumber>;
            monthly: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            daily?: number | undefined;
            monthly?: number | undefined;
        }, {
            daily?: number | undefined;
            monthly?: number | undefined;
        }>>>;
        timezone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        dailyTarget?: number | undefined;
        weeklyTarget?: number | undefined;
        monthlyTarget?: number | undefined;
        commissionRate?: number | undefined;
        expenseBudgets?: Record<string, number> | undefined;
        lateFeePerDay?: number | undefined;
        lateFeeGraceDays?: number | undefined;
        staffTargets?: Record<string, {
            daily?: number | undefined;
            monthly?: number | undefined;
        }> | undefined;
        timezone?: string | undefined;
    }, {
        dailyTarget?: number | undefined;
        weeklyTarget?: number | undefined;
        monthlyTarget?: number | undefined;
        commissionRate?: number | undefined;
        expenseBudgets?: Record<string, number> | undefined;
        lateFeePerDay?: number | undefined;
        lateFeeGraceDays?: number | undefined;
        staffTargets?: Record<string, {
            daily?: number | undefined;
            monthly?: number | undefined;
        }> | undefined;
        timezone?: string | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    shopName?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    murabahaMode?: boolean | undefined;
    settings?: {
        dailyTarget?: number | undefined;
        weeklyTarget?: number | undefined;
        monthlyTarget?: number | undefined;
        commissionRate?: number | undefined;
        expenseBudgets?: Record<string, number> | undefined;
        lateFeePerDay?: number | undefined;
        lateFeeGraceDays?: number | undefined;
        staffTargets?: Record<string, {
            daily?: number | undefined;
            monthly?: number | undefined;
        }> | undefined;
        timezone?: string | undefined;
    } | undefined;
}, {
    shopName?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    murabahaMode?: boolean | undefined;
    settings?: {
        dailyTarget?: number | undefined;
        weeklyTarget?: number | undefined;
        monthlyTarget?: number | undefined;
        commissionRate?: number | undefined;
        expenseBudgets?: Record<string, number> | undefined;
        lateFeePerDay?: number | undefined;
        lateFeeGraceDays?: number | undefined;
        staffTargets?: Record<string, {
            daily?: number | undefined;
            monthly?: number | undefined;
        }> | undefined;
        timezone?: string | undefined;
    } | undefined;
}>;
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
