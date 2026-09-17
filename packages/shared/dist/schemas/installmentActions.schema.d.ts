import { z } from 'zod';
export declare const installmentReasonSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export declare const rescheduleInstallmentSchema: z.ZodEffects<z.ZodObject<{
    newMonths: z.ZodOptional<z.ZodNumber>;
    newMonthly: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    newMonths?: number | undefined;
    newMonthly?: number | undefined;
}, {
    newMonths?: number | undefined;
    newMonthly?: number | undefined;
}>, {
    newMonths?: number | undefined;
    newMonthly?: number | undefined;
}, {
    newMonths?: number | undefined;
    newMonthly?: number | undefined;
}>;
export declare const waiverInstallmentSchema: z.ZodObject<{
    amount: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    reason?: string | undefined;
}, {
    amount: number;
    reason?: string | undefined;
}>;
export declare const pauseInstallmentSchema: z.ZodObject<{
    months: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    months: number;
    reason?: string | undefined;
}, {
    months: number;
    reason?: string | undefined;
}>;
export declare const transferInstallmentSchema: z.ZodObject<{
    newCustomerId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    newCustomerId: string;
    reason?: string | undefined;
}, {
    newCustomerId: string;
    reason?: string | undefined;
}>;
export declare const letterStatusEnum: readonly ["NONE", "FIRST_NOTICE", "SECOND_NOTICE", "LEGAL_NOTICE", "FILED"];
export declare const biometricStatusEnum: readonly ["PENDING", "SELLER_DONE", "BUYER_DONE", "COMPLETED", "NOT_REQUIRED"];
export declare const vehicleFileLocationEnum: readonly ["WITH_SHOP", "WITH_CUSTOMER", "WITH_RTO", "WITH_NADRA", "IN_TRANSFER", "WITH_COURT", "WITH_POLICE"];
export declare const installmentFieldsSchema: z.ZodEffects<z.ZodObject<{
    letterStatus: z.ZodOptional<z.ZodEnum<["NONE", "FIRST_NOTICE", "SECOND_NOTICE", "LEGAL_NOTICE", "FILED"]>>;
    biometricStatus: z.ZodOptional<z.ZodEnum<["PENDING", "SELLER_DONE", "BUYER_DONE", "COMPLETED", "NOT_REQUIRED"]>>;
    vehicleFileLocation: z.ZodOptional<z.ZodEnum<["WITH_SHOP", "WITH_CUSTOMER", "WITH_RTO", "WITH_NADRA", "IN_TRANSFER", "WITH_COURT", "WITH_POLICE"]>>;
}, "strip", z.ZodTypeAny, {
    letterStatus?: "NONE" | "FIRST_NOTICE" | "SECOND_NOTICE" | "LEGAL_NOTICE" | "FILED" | undefined;
    biometricStatus?: "PENDING" | "COMPLETED" | "SELLER_DONE" | "BUYER_DONE" | "NOT_REQUIRED" | undefined;
    vehicleFileLocation?: "WITH_SHOP" | "WITH_CUSTOMER" | "WITH_RTO" | "WITH_NADRA" | "IN_TRANSFER" | "WITH_COURT" | "WITH_POLICE" | undefined;
}, {
    letterStatus?: "NONE" | "FIRST_NOTICE" | "SECOND_NOTICE" | "LEGAL_NOTICE" | "FILED" | undefined;
    biometricStatus?: "PENDING" | "COMPLETED" | "SELLER_DONE" | "BUYER_DONE" | "NOT_REQUIRED" | undefined;
    vehicleFileLocation?: "WITH_SHOP" | "WITH_CUSTOMER" | "WITH_RTO" | "WITH_NADRA" | "IN_TRANSFER" | "WITH_COURT" | "WITH_POLICE" | undefined;
}>, {
    letterStatus?: "NONE" | "FIRST_NOTICE" | "SECOND_NOTICE" | "LEGAL_NOTICE" | "FILED" | undefined;
    biometricStatus?: "PENDING" | "COMPLETED" | "SELLER_DONE" | "BUYER_DONE" | "NOT_REQUIRED" | undefined;
    vehicleFileLocation?: "WITH_SHOP" | "WITH_CUSTOMER" | "WITH_RTO" | "WITH_NADRA" | "IN_TRANSFER" | "WITH_COURT" | "WITH_POLICE" | undefined;
}, {
    letterStatus?: "NONE" | "FIRST_NOTICE" | "SECOND_NOTICE" | "LEGAL_NOTICE" | "FILED" | undefined;
    biometricStatus?: "PENDING" | "COMPLETED" | "SELLER_DONE" | "BUYER_DONE" | "NOT_REQUIRED" | undefined;
    vehicleFileLocation?: "WITH_SHOP" | "WITH_CUSTOMER" | "WITH_RTO" | "WITH_NADRA" | "IN_TRANSFER" | "WITH_COURT" | "WITH_POLICE" | undefined;
}>;
export type InstallmentFieldsInput = z.infer<typeof installmentFieldsSchema>;
