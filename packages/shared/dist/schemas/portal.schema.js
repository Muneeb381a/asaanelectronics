import { z } from 'zod';
export const portalLoginSchema = z.object({
    cnic: z.string().regex(/^\d{13}$/, 'CNIC must be exactly 13 digits'),
    phone: z.string().min(1, 'Phone is required').max(20),
});
