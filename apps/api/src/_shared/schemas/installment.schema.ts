import { z } from 'zod';

// 1095 = 3 years in days (daily plans can run longer than 365 days)
const MONTHS_MAX = 1095;

const guarantorSchema = z.object({
  name:     z.string().min(1, 'Guarantor name required'),
  phone:    z.string().min(10, 'Valid phone required'),
  cnic:     z.string().optional(),
  relation: z.string().optional(),
  address:  z.string().optional(),
});

export const createInstallmentSchema = z.object({
  customerId:        z.string(),
  productId:         z.string(),
  totalAmount:       z.number().positive(),
  downPayment:       z.number().min(0),
  months:            z.number().int().min(1).max(MONTHS_MAX),
  startDate:         z.string().datetime(),
  imeiNumber:        z.string().max(20).optional(),
  cashPrice:         z.number().positive().optional(),
  profitMarkup:      z.number().min(0).optional(),
  paymentFrequency:  z.enum(['monthly', 'daily']).default('monthly'),
  guarantor1:        guarantorSchema,
  guarantor2:        guarantorSchema.partial().optional(),
});

export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;

export const importInstallmentRowSchema = z.object({
  customerName: z.string().min(1, 'Customer name required'),
  phone:        z.string().min(1, 'Phone required'),
  cnic:         z.string().optional(),
  area:         z.string().optional(),
  productName:  z.string().min(1, 'Product name required'),
  totalAmount:  z.coerce.number().positive('Total amount must be > 0'),
  downPayment:  z.coerce.number().min(0, 'Down payment must be ≥ 0'),
  monthly:      z.coerce.number().positive('Monthly amount must be > 0'),
  months:       z.coerce.number().int().min(1).max(MONTHS_MAX),
  startDate:    z.string().min(1, 'Start date required'),
  remaining:    z.coerce.number().min(0).optional(),
  status:       z.enum(['ACTIVE', 'PENDING', 'COMPLETED', 'DEFAULTED', 'CANCELLED']).optional(),
  imeiNumber:   z.string().optional(),
});

export const importInstallmentsSchema = z.object({
  rows: z.array(importInstallmentRowSchema).min(1).max(500),
});

export type ImportInstallmentRow    = z.infer<typeof importInstallmentRowSchema>;
export type ImportInstallmentsInput = z.infer<typeof importInstallmentsSchema>;

export const updateInstallmentSchema = z.object({
  totalAmount:      z.number().positive().optional(),
  downPayment:      z.number().min(0).optional(),
  monthly:          z.number().positive().optional(),
  months:           z.number().int().min(1).max(MONTHS_MAX).optional(),
  startDate:        z.string().optional(),
  imeiNumber:       z.string().max(20).nullable().optional(),
  cashPrice:        z.number().positive().nullable().optional(),
  profitMarkup:     z.number().min(0).nullable().optional(),
  paymentFrequency: z.enum(['monthly', 'daily']).optional(),
});

export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;
