import { z } from 'zod';
export declare const createCashSaleSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    amount: z.ZodNumber;
    method: z.ZodEnum<["CASH", "BANK", "JAZZCASH", "EASYPAISA", "OTHER"]>;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    imeiNumber: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    amount: number;
    method: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER";
    quantity: number;
    imeiNumber?: string | undefined;
    customerName?: string | undefined;
    note?: string | undefined;
    customerPhone?: string | undefined;
}, {
    productId: string;
    amount: number;
    method: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER";
    quantity: number;
    imeiNumber?: string | undefined;
    customerName?: string | undefined;
    note?: string | undefined;
    customerPhone?: string | undefined;
}>;
export type CreateCashSaleInput = z.infer<typeof createCashSaleSchema>;
