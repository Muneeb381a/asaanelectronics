import { z } from 'zod';
export declare const createExpenseClaimSchema: z.ZodObject<{
    category: z.ZodEnum<["RENT", "SALARY", "UTILITY", "PURCHASE", "MAINTENANCE", "TRANSPORT", "OTHER"]>;
    amount: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
    claimDate: z.ZodOptional<z.ZodString>;
    receiptImageUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    category: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT";
    description?: string | undefined;
    claimDate?: string | undefined;
    receiptImageUrl?: string | undefined;
}, {
    amount: number;
    category: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT";
    description?: string | undefined;
    claimDate?: string | undefined;
    receiptImageUrl?: string | undefined;
}>;
export declare const approveExpenseClaimSchema: z.ZodObject<{
    approvedAmount: z.ZodOptional<z.ZodNumber>;
    ownerNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    approvedAmount?: number | undefined;
    ownerNote?: string | undefined;
}, {
    approvedAmount?: number | undefined;
    ownerNote?: string | undefined;
}>;
export declare const rejectExpenseClaimSchema: z.ZodObject<{
    ownerNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ownerNote?: string | undefined;
}, {
    ownerNote?: string | undefined;
}>;
