import { z } from 'zod';
export declare const createInstallmentSchema: z.ZodObject<{
    customerId: z.ZodString;
    productId: z.ZodString;
    totalAmount: z.ZodNumber;
    downPayment: z.ZodNumber;
    months: z.ZodNumber;
    startDate: z.ZodString;
    imeiNumber: z.ZodOptional<z.ZodString>;
    cashPrice: z.ZodOptional<z.ZodNumber>;
    profitMarkup: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    productId: string;
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    imeiNumber?: string | undefined;
    cashPrice?: number | undefined;
    profitMarkup?: number | undefined;
}, {
    customerId: string;
    productId: string;
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    imeiNumber?: string | undefined;
    cashPrice?: number | undefined;
    profitMarkup?: number | undefined;
}>;
export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;
