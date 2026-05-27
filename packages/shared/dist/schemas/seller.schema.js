import { z } from 'zod';
export const createSellerSchema = z.object({
    shopName: z.string().min(2, 'Shop name required'),
    phone: z.string().min(10, 'Valid phone number required'),
    address: z.string().optional(),
});
