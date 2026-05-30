import { z } from 'zod';

export const createSellerSchema = z.object({
  shopName: z.string().min(2, 'Shop name required').max(100),
  phone:    z.string().min(10, 'Valid phone number required').max(15),
  address:  z.string().max(500).optional(),
});

export type CreateSellerInput = z.infer<typeof createSellerSchema>;
