import { z } from 'zod';
export const createDeliverySchema = z.object({
    saleType: z.enum(['CASH', 'INSTALLMENT']),
    saleId: z.string().min(1),
    deliveryAddress: z.string().min(1).max(500),
    driverUserId: z.string().min(1).optional(),
    driverName: z.string().min(1).max(100).optional(),
    driverPhone: z.string().max(20).optional(),
    scheduledDate: z.string().min(1).optional(),
}).refine((d) => d.driverUserId || d.driverName, {
    message: 'Provide a driverUserId or a driverName',
    path: ['driverName'],
});
export const markDeliveredSchema = z.object({
    signatureUrl: z.string().url().optional(),
    proofPhotoUrl: z.string().url().optional(),
    conditionNote: z.string().max(500).optional(),
}).refine((d) => d.signatureUrl || d.proofPhotoUrl, {
    message: 'A signature or a proof photo is required to mark a delivery as delivered',
    path: ['signatureUrl'],
});
export const markRejectedSchema = z.object({
    rejectionReason: z.string().min(1).max(500),
    proofPhotoUrl: z.string().url().optional(),
});
