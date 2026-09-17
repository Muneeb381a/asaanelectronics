import { z } from 'zod';
const reason = z.string().max(500).optional();
export const installmentReasonSchema = z.object({ reason });
export const rescheduleInstallmentSchema = z.object({
    newMonths: z.number().int().min(1).max(1095).optional(),
    newMonthly: z.number().positive().optional(),
}).refine((b) => b.newMonths !== undefined || b.newMonthly !== undefined, { message: 'newMonths or newMonthly required' });
export const waiverInstallmentSchema = z.object({
    amount: z.number().positive(),
    reason,
});
export const pauseInstallmentSchema = z.object({
    months: z.number().int().min(1).max(12),
    reason,
});
export const transferInstallmentSchema = z.object({
    newCustomerId: z.string().min(1),
    reason,
});
export const letterStatusEnum = ['NONE', 'FIRST_NOTICE', 'SECOND_NOTICE', 'LEGAL_NOTICE', 'FILED'];
export const biometricStatusEnum = ['PENDING', 'SELLER_DONE', 'BUYER_DONE', 'COMPLETED', 'NOT_REQUIRED'];
export const vehicleFileLocationEnum = ['WITH_SHOP', 'WITH_CUSTOMER', 'WITH_RTO', 'WITH_NADRA', 'IN_TRANSFER', 'WITH_COURT', 'WITH_POLICE'];
export const installmentFieldsSchema = z.object({
    letterStatus: z.enum(letterStatusEnum).optional(),
    biometricStatus: z.enum(biometricStatusEnum).optional(),
    vehicleFileLocation: z.enum(vehicleFileLocationEnum).optional(),
}).refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'No fields to update' });
