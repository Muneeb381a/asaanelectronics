import { z } from 'zod';
export declare const createRepossessionSchema: z.ZodObject<{
    installmentId: z.ZodString;
    repossessedDate: z.ZodString;
    deviceName: z.ZodString;
    imei: z.ZodOptional<z.ZodString>;
    condition: z.ZodEnum<["good", "fair", "poor"]>;
    reason: z.ZodOptional<z.ZodString>;
    amountRecovered: z.ZodOptional<z.ZodNumber>;
    assessedValue: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    installmentId: string;
    condition: "good" | "fair" | "poor";
    deviceName: string;
    repossessedDate: string;
    reason?: string | undefined;
    notes?: string | undefined;
    imei?: string | undefined;
    assessedValue?: number | undefined;
    amountRecovered?: number | undefined;
}, {
    installmentId: string;
    condition: "good" | "fair" | "poor";
    deviceName: string;
    repossessedDate: string;
    reason?: string | undefined;
    notes?: string | undefined;
    imei?: string | undefined;
    assessedValue?: number | undefined;
    amountRecovered?: number | undefined;
}>;
export declare const updateRepossessionSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["in_stock", "sold", "disposed", "returned"]>>;
    soldPrice: z.ZodOptional<z.ZodNumber>;
    condition: z.ZodOptional<z.ZodEnum<["good", "fair", "poor"]>>;
    notes: z.ZodOptional<z.ZodString>;
    assessedValue: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status?: "sold" | "returned" | "in_stock" | "disposed" | undefined;
    notes?: string | undefined;
    condition?: "good" | "fair" | "poor" | undefined;
    assessedValue?: number | undefined;
    soldPrice?: number | undefined;
}, {
    status?: "sold" | "returned" | "in_stock" | "disposed" | undefined;
    notes?: string | undefined;
    condition?: "good" | "fair" | "poor" | undefined;
    assessedValue?: number | undefined;
    soldPrice?: number | undefined;
}>;
