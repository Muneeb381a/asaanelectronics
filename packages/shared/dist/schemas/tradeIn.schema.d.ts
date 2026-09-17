import { z } from 'zod';
export declare const createTradeInSchema: z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    installmentId: z.ZodOptional<z.ZodString>;
    cashSaleId: z.ZodOptional<z.ZodString>;
    deviceName: z.ZodString;
    brand: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    imei: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    storageGb: z.ZodOptional<z.ZodNumber>;
    condition: z.ZodEnum<["good", "fair", "poor"]>;
    assessedValue: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    condition: "good" | "fair" | "poor";
    deviceName: string;
    assessedValue: number;
    notes?: string | undefined;
    customerId?: string | undefined;
    installmentId?: string | undefined;
    brand?: string | undefined;
    model?: string | undefined;
    color?: string | undefined;
    imei?: string | undefined;
    storageGb?: number | undefined;
    cashSaleId?: string | undefined;
}, {
    condition: "good" | "fair" | "poor";
    deviceName: string;
    assessedValue: number;
    notes?: string | undefined;
    customerId?: string | undefined;
    installmentId?: string | undefined;
    brand?: string | undefined;
    model?: string | undefined;
    color?: string | undefined;
    imei?: string | undefined;
    storageGb?: number | undefined;
    cashSaleId?: string | undefined;
}>;
export declare const updateTradeInSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["in_stock", "sold", "disposed"]>>;
    soldPrice: z.ZodOptional<z.ZodNumber>;
    condition: z.ZodOptional<z.ZodEnum<["good", "fair", "poor"]>>;
    notes: z.ZodOptional<z.ZodString>;
    assessedValue: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status?: "sold" | "in_stock" | "disposed" | undefined;
    notes?: string | undefined;
    condition?: "good" | "fair" | "poor" | undefined;
    assessedValue?: number | undefined;
    soldPrice?: number | undefined;
}, {
    status?: "sold" | "in_stock" | "disposed" | undefined;
    notes?: string | undefined;
    condition?: "good" | "fair" | "poor" | undefined;
    assessedValue?: number | undefined;
    soldPrice?: number | undefined;
}>;
