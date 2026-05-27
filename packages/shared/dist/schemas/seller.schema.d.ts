import { z } from 'zod';
export declare const createSellerSchema: z.ZodObject<{
    shopName: z.ZodString;
    phone: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    shopName: string;
    phone: string;
    address?: string | undefined;
}, {
    shopName: string;
    phone: string;
    address?: string | undefined;
}>;
export type CreateSellerInput = z.infer<typeof createSellerSchema>;
