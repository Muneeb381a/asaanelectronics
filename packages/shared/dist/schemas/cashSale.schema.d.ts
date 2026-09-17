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
    note?: string | undefined;
    imeiNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
}, {
    productId: string;
    amount: number;
    method: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER";
    quantity: number;
    note?: string | undefined;
    imeiNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
}>;
export type CreateCashSaleInput = z.infer<typeof createCashSaleSchema>;
export declare const updateCashSaleSchema: z.ZodObject<{
    amount: z.ZodOptional<z.ZodNumber>;
    method: z.ZodOptional<z.ZodEnum<["CASH", "BANK", "JAZZCASH", "EASYPAISA", "OTHER"]>>;
    customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerPhone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imeiNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
    imeiNumber?: string | null | undefined;
    customerName?: string | null | undefined;
    amount?: number | undefined;
    method?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    customerPhone?: string | null | undefined;
}, {
    note?: string | null | undefined;
    imeiNumber?: string | null | undefined;
    customerName?: string | null | undefined;
    amount?: number | undefined;
    method?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    customerPhone?: string | null | undefined;
}>;
