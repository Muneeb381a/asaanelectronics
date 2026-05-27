import { z } from 'zod';
export declare const createRecoverySchema: z.ZodObject<{
    installmentId: z.ZodString;
    type: z.ZodEnum<["CALLED", "VISITED", "PROMISE_TO_PAY", "REFUSED", "LEGAL_WARNING"]>;
    note: z.ZodOptional<z.ZodString>;
    promiseDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "CALLED" | "VISITED" | "PROMISE_TO_PAY" | "REFUSED" | "LEGAL_WARNING";
    installmentId: string;
    note?: string | undefined;
    promiseDate?: string | undefined;
}, {
    type: "CALLED" | "VISITED" | "PROMISE_TO_PAY" | "REFUSED" | "LEGAL_WARNING";
    installmentId: string;
    note?: string | undefined;
    promiseDate?: string | undefined;
}>;
export type CreateRecoveryInput = z.infer<typeof createRecoverySchema>;
