import { z } from 'zod';
export declare const createReturnSchema: z.ZodObject<{
    customerId: z.ZodString;
    productId: z.ZodString;
    installmentId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["RETURN", "EXCHANGE", "WARRANTY_REPLACEMENT"]>;
    reason: z.ZodEnum<["DEFECTIVE", "DAMAGED_IN_USE", "WRONG_ITEM", "CUSTOMER_REQUEST", "WARRANTY_CLAIM", "OTHER"]>;
    condition: z.ZodEnum<["GOOD", "DAMAGED", "UNUSABLE"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "RETURN" | "EXCHANGE" | "WARRANTY_REPLACEMENT";
    reason: "OTHER" | "DEFECTIVE" | "DAMAGED_IN_USE" | "WRONG_ITEM" | "CUSTOMER_REQUEST" | "WARRANTY_CLAIM";
    customerId: string;
    productId: string;
    condition: "GOOD" | "DAMAGED" | "UNUSABLE";
    notes?: string | undefined;
    installmentId?: string | undefined;
}, {
    type: "RETURN" | "EXCHANGE" | "WARRANTY_REPLACEMENT";
    reason: "OTHER" | "DEFECTIVE" | "DAMAGED_IN_USE" | "WRONG_ITEM" | "CUSTOMER_REQUEST" | "WARRANTY_CLAIM";
    customerId: string;
    productId: string;
    condition: "GOOD" | "DAMAGED" | "UNUSABLE";
    notes?: string | undefined;
    installmentId?: string | undefined;
}>;
export declare const resolveReturnSchema: z.ZodObject<{
    status: z.ZodEnum<["APPROVED", "REJECTED"]>;
    resolutionType: z.ZodOptional<z.ZodEnum<["RESALE", "DAMAGED_WRITE_OFF", "REPLACEMENT_SENT"]>>;
    replacementProductId: z.ZodOptional<z.ZodString>;
    refundAmount: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "APPROVED" | "REJECTED";
    notes?: string | undefined;
    resolutionType?: "RESALE" | "DAMAGED_WRITE_OFF" | "REPLACEMENT_SENT" | undefined;
    replacementProductId?: string | undefined;
    refundAmount?: number | undefined;
}, {
    status: "APPROVED" | "REJECTED";
    notes?: string | undefined;
    resolutionType?: "RESALE" | "DAMAGED_WRITE_OFF" | "REPLACEMENT_SENT" | undefined;
    replacementProductId?: string | undefined;
    refundAmount?: number | undefined;
}>;
