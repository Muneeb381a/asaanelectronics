import { z } from 'zod';
export declare const assignCustomerSchema: z.ZodObject<{
    customerId: z.ZodString;
    agentId: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    agentId: string;
    notes?: string | undefined;
}, {
    customerId: string;
    agentId: string;
    notes?: string | undefined;
}>;
export declare const addDeductionSchema: z.ZodObject<{
    staffId: z.ZodString;
    month: z.ZodString;
    type: z.ZodEnum<["UNCOLLECTED", "ADVANCE", "DAMAGE", "OTHER"]>;
    amount: z.ZodNumber;
    description: z.ZodString;
    installmentId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "OTHER" | "UNCOLLECTED" | "ADVANCE" | "DAMAGE";
    amount: number;
    description: string;
    staffId: string;
    month: string;
    customerId?: string | undefined;
    installmentId?: string | undefined;
}, {
    type: "OTHER" | "UNCOLLECTED" | "ADVANCE" | "DAMAGE";
    amount: number;
    description: string;
    staffId: string;
    month: string;
    customerId?: string | undefined;
    installmentId?: string | undefined;
}>;
export declare const calculateDeductionsSchema: z.ZodObject<{
    month: z.ZodString;
}, "strip", z.ZodTypeAny, {
    month: string;
}, {
    month: string;
}>;
