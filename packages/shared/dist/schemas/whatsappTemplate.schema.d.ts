import { z } from 'zod';
export declare const whatsappTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    body: string;
}, {
    name: string;
    body: string;
}>;
