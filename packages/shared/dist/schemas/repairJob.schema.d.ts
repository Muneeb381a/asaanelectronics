import { z } from 'zod';
export declare const repairJobStatus: z.ZodEnum<["RECEIVED", "DIAGNOSING", "AWAITING_PARTS", "REPAIRING", "REPAIRED", "UNREPAIRABLE", "RETURNED"]>;
export declare const createRepairJobSchema: z.ZodObject<{
    customerName: z.ZodString;
    customerPhone: z.ZodString;
    deviceName: z.ZodString;
    imeiNumber: z.ZodOptional<z.ZodString>;
    issueDescription: z.ZodString;
    estimatedCost: z.ZodOptional<z.ZodNumber>;
    promisedAt: z.ZodOptional<z.ZodString>;
    assignedToId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    customerName: string;
    customerPhone: string;
    deviceName: string;
    issueDescription: string;
    notes?: string | undefined;
    imeiNumber?: string | undefined;
    estimatedCost?: number | undefined;
    promisedAt?: string | undefined;
    assignedToId?: string | undefined;
}, {
    customerName: string;
    customerPhone: string;
    deviceName: string;
    issueDescription: string;
    notes?: string | undefined;
    imeiNumber?: string | undefined;
    estimatedCost?: number | undefined;
    promisedAt?: string | undefined;
    assignedToId?: string | undefined;
}>;
export declare const updateRepairJobStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["RECEIVED", "DIAGNOSING", "AWAITING_PARTS", "REPAIRING", "REPAIRED", "UNREPAIRABLE", "RETURNED"]>;
    actualCost: z.ZodOptional<z.ZodNumber>;
    paymentMethod: z.ZodOptional<z.ZodEnum<["CASH", "BANK", "JAZZCASH", "EASYPAISA", "OTHER"]>>;
    partsUsed: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "RECEIVED" | "DIAGNOSING" | "AWAITING_PARTS" | "REPAIRING" | "REPAIRED" | "UNREPAIRABLE" | "RETURNED";
    notes?: string | undefined;
    paymentMethod?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    actualCost?: number | undefined;
    partsUsed?: string | undefined;
}, {
    status: "RECEIVED" | "DIAGNOSING" | "AWAITING_PARTS" | "REPAIRING" | "REPAIRED" | "UNREPAIRABLE" | "RETURNED";
    notes?: string | undefined;
    paymentMethod?: "CASH" | "BANK" | "JAZZCASH" | "EASYPAISA" | "OTHER" | undefined;
    actualCost?: number | undefined;
    partsUsed?: string | undefined;
}>;
export declare const updateRepairJobSchema: z.ZodObject<{
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    deviceName: z.ZodOptional<z.ZodString>;
    imeiNumber: z.ZodOptional<z.ZodString>;
    issueDescription: z.ZodOptional<z.ZodString>;
    estimatedCost: z.ZodOptional<z.ZodNumber>;
    promisedAt: z.ZodOptional<z.ZodString>;
    assignedToId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    imeiNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    deviceName?: string | undefined;
    issueDescription?: string | undefined;
    estimatedCost?: number | undefined;
    promisedAt?: string | undefined;
    assignedToId?: string | undefined;
}, {
    notes?: string | undefined;
    imeiNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    deviceName?: string | undefined;
    issueDescription?: string | undefined;
    estimatedCost?: number | undefined;
    promisedAt?: string | undefined;
    assignedToId?: string | undefined;
}>;
export type CreateRepairJobInput = z.infer<typeof createRepairJobSchema>;
export type UpdateRepairJobStatusInput = z.infer<typeof updateRepairJobStatusSchema>;
export type UpdateRepairJobInput = z.infer<typeof updateRepairJobSchema>;
