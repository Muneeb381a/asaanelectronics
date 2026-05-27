import { z } from 'zod';
export declare const portalLoginSchema: z.ZodObject<{
    cnic: z.ZodString;
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    cnic: string;
}, {
    phone: string;
    cnic: string;
}>;
