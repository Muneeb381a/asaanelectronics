import { z } from 'zod';
export declare const createInvestorSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    cnic: z.ZodOptional<z.ZodString>;
    profitSharePercent: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    profitSharePercent: number;
    phone?: string | undefined;
    cnic?: string | undefined;
    notes?: string | undefined;
}, {
    name: string;
    profitSharePercent: number;
    phone?: string | undefined;
    cnic?: string | undefined;
    notes?: string | undefined;
}>;
export declare const updateInvestorSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cnic: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    profitSharePercent: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    phone?: string | null | undefined;
    cnic?: string | null | undefined;
    notes?: string | null | undefined;
    isActive?: boolean | undefined;
    profitSharePercent?: number | undefined;
}, {
    name?: string | undefined;
    phone?: string | null | undefined;
    cnic?: string | null | undefined;
    notes?: string | null | undefined;
    isActive?: boolean | undefined;
    profitSharePercent?: number | undefined;
}>;
export declare const addContributionSchema: z.ZodObject<{
    amount: z.ZodNumber;
    contributedOn: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    contributedOn: string;
    note?: string | undefined;
}, {
    amount: number;
    contributedOn: string;
    note?: string | undefined;
}>;
export declare const recordInvestorPayoutSchema: z.ZodObject<{
    period: z.ZodString;
    method: z.ZodEnum<["MANUAL", "AUTO"]>;
    calculatedShare: z.ZodOptional<z.ZodNumber>;
    amount: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
    paidOn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    method: "MANUAL" | "AUTO";
    paidOn: string;
    period: string;
    note?: string | undefined;
    calculatedShare?: number | undefined;
}, {
    amount: number;
    method: "MANUAL" | "AUTO";
    paidOn: string;
    period: string;
    note?: string | undefined;
    calculatedShare?: number | undefined;
}>;
