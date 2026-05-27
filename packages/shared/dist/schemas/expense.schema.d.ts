import { z } from 'zod';
export declare const createExpenseSchema: z.ZodObject<{
    category: z.ZodEnum<["RENT", "SALARY", "UTILITY", "PURCHASE", "MAINTENANCE", "TRANSPORT", "OTHER"]>;
    amount: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    category: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT";
    date?: string | undefined;
    description?: string | undefined;
}, {
    amount: number;
    category: "OTHER" | "RENT" | "SALARY" | "UTILITY" | "PURCHASE" | "MAINTENANCE" | "TRANSPORT";
    date?: string | undefined;
    description?: string | undefined;
}>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
