import { z } from 'zod';
export const createRecoverySchema = z.object({
    installmentId: z.string().min(1),
    type: z.enum(['CALLED', 'VISITED', 'PROMISE_TO_PAY', 'REFUSED', 'LEGAL_WARNING']),
    note: z.string().max(500).optional(),
    promiseDate: z.string().optional(),
});
