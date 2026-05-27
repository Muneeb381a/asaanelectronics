import { z } from 'zod';
export const createProductSchema = z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    color: z.string().optional(),
    price: z.number().positive(),
    installmentPrice: z.number().positive().optional(),
    purchasePrice: z.number().positive().optional(),
    stock: z.number().int().min(0).default(0),
    serial: z.string().optional(),
    warrantyMonths: z.number().int().min(0).optional(),
    description: z.string().optional(),
});
export const updateProductSchema = createProductSchema.partial();
