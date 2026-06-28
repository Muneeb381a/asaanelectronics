import { z } from 'zod';
function luhnCheck(imei) {
    let sum = 0;
    for (let i = 0; i < 15; i++) {
        let d = parseInt(imei[i]);
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9)
                d -= 9;
        }
        sum += d;
    }
    return sum % 10 === 0;
}
export const imeiField = z
    .string()
    .regex(/^\d{15}$/, 'IMEI must be exactly 15 digits')
    .refine(luhnCheck, 'Invalid IMEI (Luhn checksum failed — check for typos)');
export const createProductUnitSchema = z.object({
    imei: imeiField,
    imei2: imeiField.optional(),
    productId: z.string().optional(),
    color: z.string().max(50).optional(),
    storageGb: z.number().int().positive().optional(),
    condition: z.enum(['new', 'refurbished']).default('new'),
    purchasePrice: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
});
export const bulkCreateProductUnitsSchema = z.object({
    imeis: z.array(imeiField).min(1).max(100),
    productId: z.string().optional(),
    condition: z.enum(['new', 'refurbished']).default('new'),
    color: z.string().max(50).optional(),
    storageGb: z.number().int().positive().optional(),
});
export const updateProductUnitSchema = z.object({
    status: z.enum(['available', 'sold', 'defective', 'returned']).optional(),
    notes: z.string().max(500).nullable().optional(),
    color: z.string().max(50).nullable().optional(),
    storageGb: z.number().int().positive().nullable().optional(),
    productId: z.string().nullable().optional(),
    condition: z.enum(['new', 'refurbished']).optional(),
    ptaStatus: z.enum(['approved', 'non_pta', 'unknown']).optional(),
});
