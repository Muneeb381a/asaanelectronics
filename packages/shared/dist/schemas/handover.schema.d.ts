import { z } from 'zod';
export declare const createHandoverSchema: z.ZodObject<{
    handedAmount: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
    handoverDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    handedAmount: number;
    note?: string | undefined;
    handoverDate?: string | undefined;
}, {
    handedAmount: number;
    note?: string | undefined;
    handoverDate?: string | undefined;
}>;
export declare const directReceiveHandoverSchema: z.ZodObject<{
    staffId: z.ZodString;
    amount: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    staffId: string;
    note?: string | undefined;
}, {
    amount: number;
    staffId: string;
    note?: string | undefined;
}>;
export declare const confirmHandoverSchema: z.ZodObject<{
    confirmedAmount: z.ZodNumber;
    ownerNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confirmedAmount: number;
    ownerNote?: string | undefined;
}, {
    confirmedAmount: number;
    ownerNote?: string | undefined;
}>;
export declare const disputeHandoverSchema: z.ZodObject<{
    ownerNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ownerNote?: string | undefined;
}, {
    ownerNote?: string | undefined;
}>;
