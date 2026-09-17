import { z } from 'zod';
export const createShopSchema = z.object({
    shopName: z.string().min(2).max(100),
    phone: z.string().min(10).max(15),
    address: z.string().max(500).optional(),
    plan: z.enum(['TRIAL', 'BASIC', 'PRO']).optional(),
});
export const createShopOwnerSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
});
export const toggleShopStatusSchema = z.object({ isActive: z.boolean() });
export const addPaymentLogSchema = z.object({
    amount: z.number().positive(),
    method: z.string().max(30).optional().default('BANK'),
    reference: z.string().max(100).optional(),
    forMonth: z.string().max(10).optional(),
    note: z.string().max(500).optional(),
});
export const shopNoteSchema = z.object({ content: z.string().min(1).max(2000) });
export const createBroadcastSchema = z.object({
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(2000),
    targetPlan: z.string().max(20).optional().default('ALL'),
    type: z.string().max(20).optional().default('info'),
    expiresAt: z.string().max(40).optional(),
});
export const updateBroadcastSchema = z.object({
    isActive: z.boolean().optional(),
    title: z.string().min(1).max(200).optional(),
    message: z.string().min(1).max(2000).optional(),
    expiresAt: z.string().max(40).nullable().optional(),
});
