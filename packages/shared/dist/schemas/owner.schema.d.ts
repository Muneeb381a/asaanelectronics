import { z } from 'zod';
export declare const createShopSchema: z.ZodObject<{
    shopName: z.ZodString;
    phone: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    plan: z.ZodOptional<z.ZodEnum<["TRIAL", "BASIC", "PRO"]>>;
}, "strip", z.ZodTypeAny, {
    shopName: string;
    phone: string;
    address?: string | undefined;
    plan?: "TRIAL" | "BASIC" | "PRO" | undefined;
}, {
    shopName: string;
    phone: string;
    address?: string | undefined;
    plan?: "TRIAL" | "BASIC" | "PRO" | undefined;
}>;
export declare const createShopOwnerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
}, {
    name: string;
    email: string;
    password: string;
}>;
export declare const toggleShopStatusSchema: z.ZodObject<{
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
}, {
    isActive: boolean;
}>;
export declare const rejectShopSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export declare const addPaymentLogSchema: z.ZodObject<{
    amount: z.ZodNumber;
    method: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    reference: z.ZodOptional<z.ZodString>;
    forMonth: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    method: string;
    note?: string | undefined;
    reference?: string | undefined;
    forMonth?: string | undefined;
}, {
    amount: number;
    note?: string | undefined;
    method?: string | undefined;
    reference?: string | undefined;
    forMonth?: string | undefined;
}>;
export declare const shopNoteSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export declare const createBroadcastSchema: z.ZodObject<{
    title: z.ZodString;
    message: z.ZodString;
    targetPlan: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    type: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: string;
    title: string;
    targetPlan: string;
    expiresAt?: string | undefined;
}, {
    message: string;
    title: string;
    type?: string | undefined;
    targetPlan?: string | undefined;
    expiresAt?: string | undefined;
}>;
export declare const updateBroadcastSchema: z.ZodObject<{
    isActive: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    message?: string | undefined;
    isActive?: boolean | undefined;
    title?: string | undefined;
    expiresAt?: string | null | undefined;
}, {
    message?: string | undefined;
    isActive?: boolean | undefined;
    title?: string | undefined;
    expiresAt?: string | null | undefined;
}>;
