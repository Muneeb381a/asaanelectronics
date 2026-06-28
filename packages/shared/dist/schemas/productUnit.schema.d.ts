import { z } from 'zod';
export declare const imeiField: z.ZodEffects<z.ZodString, string, string>;
export declare const createProductUnitSchema: z.ZodObject<{
    imei: z.ZodEffects<z.ZodString, string, string>;
    imei2: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    productId: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    storageGb: z.ZodOptional<z.ZodNumber>;
    condition: z.ZodDefault<z.ZodEnum<["new", "refurbished"]>>;
    purchasePrice: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    imei: string;
    condition: "new" | "refurbished";
    productId?: string | undefined;
    color?: string | undefined;
    purchasePrice?: number | undefined;
    notes?: string | undefined;
    imei2?: string | undefined;
    storageGb?: number | undefined;
}, {
    imei: string;
    productId?: string | undefined;
    color?: string | undefined;
    purchasePrice?: number | undefined;
    notes?: string | undefined;
    imei2?: string | undefined;
    storageGb?: number | undefined;
    condition?: "new" | "refurbished" | undefined;
}>;
export type CreateProductUnitInput = z.infer<typeof createProductUnitSchema>;
export declare const bulkCreateProductUnitsSchema: z.ZodObject<{
    imeis: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    productId: z.ZodOptional<z.ZodString>;
    condition: z.ZodDefault<z.ZodEnum<["new", "refurbished"]>>;
    color: z.ZodOptional<z.ZodString>;
    storageGb: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    condition: "new" | "refurbished";
    imeis: string[];
    productId?: string | undefined;
    color?: string | undefined;
    storageGb?: number | undefined;
}, {
    imeis: string[];
    productId?: string | undefined;
    color?: string | undefined;
    storageGb?: number | undefined;
    condition?: "new" | "refurbished" | undefined;
}>;
export type BulkCreateProductUnitsInput = z.infer<typeof bulkCreateProductUnitsSchema>;
export declare const updateProductUnitSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["available", "sold", "defective", "returned"]>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    storageGb: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    productId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    condition: z.ZodOptional<z.ZodEnum<["new", "refurbished"]>>;
    ptaStatus: z.ZodOptional<z.ZodEnum<["approved", "non_pta", "unknown"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "available" | "sold" | "defective" | "returned" | undefined;
    productId?: string | null | undefined;
    color?: string | null | undefined;
    notes?: string | null | undefined;
    storageGb?: number | null | undefined;
    condition?: "new" | "refurbished" | undefined;
    ptaStatus?: "unknown" | "approved" | "non_pta" | undefined;
}, {
    status?: "available" | "sold" | "defective" | "returned" | undefined;
    productId?: string | null | undefined;
    color?: string | null | undefined;
    notes?: string | null | undefined;
    storageGb?: number | null | undefined;
    condition?: "new" | "refurbished" | undefined;
    ptaStatus?: "unknown" | "approved" | "non_pta" | undefined;
}>;
export type UpdateProductUnitInput = z.infer<typeof updateProductUnitSchema>;
