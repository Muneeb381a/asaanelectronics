import { z } from 'zod';
export declare const paymentMethodEnum: readonly ["CASH", "BANK", "JAZZCASH", "EASYPAISA", "OTHER"];
export declare const createPaymentSchema: z.ZodObject<{
    installmentId: z.ZodString;
    amount: z.ZodNumber;
    method: z.ZodEnum<["CASH", "BANK", "JAZZCASH", "EASYPAISA", "OTHER"]>;
    note: z.ZodOptional<z.ZodString>;
    collectedBy: z.ZodOptional<z.ZodString>;
    proofImageUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    installmentId: string;
    amount: number;
    method: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER";
    note?: string | undefined;
    collectedBy?: string | undefined;
    proofImageUrl?: string | undefined;
}, {
    installmentId: string;
    amount: number;
    method: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER";
    note?: string | undefined;
    collectedBy?: string | undefined;
    proofImageUrl?: string | undefined;
}>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export declare const updatePaymentSchema: z.ZodEffects<z.ZodObject<{
    amount: z.ZodOptional<z.ZodNumber>;
    method: z.ZodOptional<z.ZodEnum<["CASH", "BANK", "JAZZCASH", "EASYPAISA", "OTHER"]>>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount?: number | undefined;
    method?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    note?: string | undefined;
}, {
    amount?: number | undefined;
    method?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    note?: string | undefined;
}>, {
    amount?: number | undefined;
    method?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    note?: string | undefined;
}, {
    amount?: number | undefined;
    method?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    note?: string | undefined;
}>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
