import { z } from 'zod';
export declare const createDeliverySchema: z.ZodEffects<z.ZodObject<{
    saleType: z.ZodEnum<["CASH", "INSTALLMENT"]>;
    saleId: z.ZodString;
    deliveryAddress: z.ZodString;
    driverUserId: z.ZodOptional<z.ZodString>;
    driverName: z.ZodOptional<z.ZodString>;
    driverPhone: z.ZodOptional<z.ZodString>;
    scheduledDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    saleType: "CASH" | "INSTALLMENT";
    saleId: string;
    deliveryAddress: string;
    driverUserId?: string | undefined;
    driverName?: string | undefined;
    driverPhone?: string | undefined;
    scheduledDate?: string | undefined;
}, {
    saleType: "CASH" | "INSTALLMENT";
    saleId: string;
    deliveryAddress: string;
    driverUserId?: string | undefined;
    driverName?: string | undefined;
    driverPhone?: string | undefined;
    scheduledDate?: string | undefined;
}>, {
    saleType: "CASH" | "INSTALLMENT";
    saleId: string;
    deliveryAddress: string;
    driverUserId?: string | undefined;
    driverName?: string | undefined;
    driverPhone?: string | undefined;
    scheduledDate?: string | undefined;
}, {
    saleType: "CASH" | "INSTALLMENT";
    saleId: string;
    deliveryAddress: string;
    driverUserId?: string | undefined;
    driverName?: string | undefined;
    driverPhone?: string | undefined;
    scheduledDate?: string | undefined;
}>;
export declare const markDeliveredSchema: z.ZodEffects<z.ZodObject<{
    signatureUrl: z.ZodOptional<z.ZodString>;
    proofPhotoUrl: z.ZodOptional<z.ZodString>;
    conditionNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    signatureUrl?: string | undefined;
    proofPhotoUrl?: string | undefined;
    conditionNote?: string | undefined;
}, {
    signatureUrl?: string | undefined;
    proofPhotoUrl?: string | undefined;
    conditionNote?: string | undefined;
}>, {
    signatureUrl?: string | undefined;
    proofPhotoUrl?: string | undefined;
    conditionNote?: string | undefined;
}, {
    signatureUrl?: string | undefined;
    proofPhotoUrl?: string | undefined;
    conditionNote?: string | undefined;
}>;
export declare const markRejectedSchema: z.ZodObject<{
    rejectionReason: z.ZodString;
    proofPhotoUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rejectionReason: string;
    proofPhotoUrl?: string | undefined;
}, {
    rejectionReason: string;
    proofPhotoUrl?: string | undefined;
}>;
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type MarkDeliveredInput = z.infer<typeof markDeliveredSchema>;
export type MarkRejectedInput = z.infer<typeof markRejectedSchema>;
