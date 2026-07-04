import { z } from 'zod';
export const createProductSchema = z.object({
    name: z.string().min(1).max(200),
    category: z.string().max(100).optional(),
    brand: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    color: z.string().max(50).optional(),
    price: z.number().positive(),
    installmentPrice: z.number().positive().optional(),
    purchasePrice: z.number().positive().optional(),
    stock: z.number().int().min(0).default(0),
    minStock: z.number().int().min(0).optional(),
    photoUrl: z.string().url().optional().or(z.literal('')),
    serial: z.string().max(100).optional(),
    warrantyMonths: z.number().int().min(0).optional(),
    description: z.string().max(1000).optional(),
    supplierId: z.string().optional(),
});
export const updateProductSchema = createProductSchema.partial();
