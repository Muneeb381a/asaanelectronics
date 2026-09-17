import { z } from 'zod';
export const whatsappTemplateSchema = z.object({
    name: z.string().min(1).max(100),
    body: z.string().min(1).max(2000),
});
