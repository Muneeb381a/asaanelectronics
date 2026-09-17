import { z } from 'zod';
export declare const createExpenseSchema: z.ZodObject<{
    category: z.ZodEnum<["RENT", "SALARY", "UTILITY", "PURCHASE", "MAINTENANCE", "TRANSPORT", "OTHER"]>;
    amount: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodString>;
    isRecurring: z.ZodOptional<z.ZodBoolean>;
    recurrenceDay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    category: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT";
    date?: string | undefined;
    description?: string | undefined;
    isRecurring?: boolean | undefined;
    recurrenceDay?: number | undefined;
}, {
    amount: number;
    category: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT";
    date?: string | undefined;
    description?: string | undefined;
    isRecurring?: boolean | undefined;
    recurrenceDay?: number | undefined;
}>;
export declare const updateExpenseSchema: z.ZodEffects<z.ZodObject<{
    category: z.ZodOptional<z.ZodEnum<["RENT", "SALARY", "UTILITY", "PURCHASE", "MAINTENANCE", "TRANSPORT", "OTHER"]>>;
    amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    date: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isRecurring: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    recurrenceDay: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    category?: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT" | undefined;
    isRecurring?: boolean | undefined;
    recurrenceDay?: number | undefined;
}, {
    date?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    category?: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT" | undefined;
    isRecurring?: boolean | undefined;
    recurrenceDay?: number | undefined;
}>, {
    date?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    category?: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT" | undefined;
    isRecurring?: boolean | undefined;
    recurrenceDay?: number | undefined;
}, {
    date?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    category?: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT" | undefined;
    isRecurring?: boolean | undefined;
    recurrenceDay?: number | undefined;
}>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
