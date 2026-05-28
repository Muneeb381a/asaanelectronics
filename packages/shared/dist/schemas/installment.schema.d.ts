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
    paymentFrequency: z.ZodDefault<z.ZodEnum<["monthly", "daily"]>>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    productId: string;
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    paymentFrequency: "monthly" | "daily";
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
    paymentFrequency?: "monthly" | "daily" | undefined;
}>;
export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;
