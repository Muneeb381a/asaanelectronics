import { z } from 'zod';
export declare const createInstallmentSchema: z.ZodObject<{
    guarantor1: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        cnic: z.ZodOptional<z.ZodString>;
        relation: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    }, {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    }>>;
    guarantor2: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        cnic: z.ZodOptional<z.ZodString>;
        relation: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    }, {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    }>>;
    customerId: z.ZodString;
    productId: z.ZodString;
    totalAmount: z.ZodNumber;
    downPayment: z.ZodNumber;
    months: z.ZodNumber;
    startDate: z.ZodString;
    imeiNumber: z.ZodOptional<z.ZodString>;
    cashPrice: z.ZodOptional<z.ZodNumber>;
    profitMarkup: z.ZodOptional<z.ZodNumber>;
    paymentFrequency: z.ZodDefault<z.ZodEnum<["monthly", "daily"]>>;
    paymentDueDay: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    productId: string;
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    paymentFrequency: "daily" | "monthly";
    guarantor1?: {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    } | undefined;
    guarantor2?: {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    } | undefined;
    imeiNumber?: string | undefined;
    cashPrice?: number | undefined;
    profitMarkup?: number | undefined;
    paymentDueDay?: number | undefined;
}, {
    customerId: string;
    productId: string;
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    guarantor1?: {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    } | undefined;
    guarantor2?: {
        name?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        cnic?: string | undefined;
        relation?: string | undefined;
    } | undefined;
    imeiNumber?: string | undefined;
    cashPrice?: number | undefined;
    profitMarkup?: number | undefined;
    paymentFrequency?: "daily" | "monthly" | undefined;
    paymentDueDay?: number | undefined;
}>;
export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;
export declare const importInstallmentRowSchema: z.ZodObject<{
    customerName: z.ZodString;
    phone: z.ZodString;
    cnic: z.ZodOptional<z.ZodString>;
    area: z.ZodOptional<z.ZodString>;
    productName: z.ZodString;
    totalAmount: z.ZodNumber;
    downPayment: z.ZodNumber;
    monthly: z.ZodNumber;
    months: z.ZodNumber;
    startDate: z.ZodString;
    remaining: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "PENDING", "COMPLETED", "DEFAULTED", "CANCELLED"]>>;
    imeiNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    monthly: number;
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    customerName: string;
    productName: string;
    status?: "ACTIVE" | "PENDING" | "COMPLETED" | "DEFAULTED" | "CANCELLED" | undefined;
    cnic?: string | undefined;
    area?: string | undefined;
    imeiNumber?: string | undefined;
    remaining?: number | undefined;
}, {
    phone: string;
    monthly: number;
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    customerName: string;
    productName: string;
    status?: "ACTIVE" | "PENDING" | "COMPLETED" | "DEFAULTED" | "CANCELLED" | undefined;
    cnic?: string | undefined;
    area?: string | undefined;
    imeiNumber?: string | undefined;
    remaining?: number | undefined;
}>;
export declare const importInstallmentsSchema: z.ZodObject<{
    rows: z.ZodArray<z.ZodObject<{
        customerName: z.ZodString;
        phone: z.ZodString;
        cnic: z.ZodOptional<z.ZodString>;
        area: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        totalAmount: z.ZodNumber;
        downPayment: z.ZodNumber;
        monthly: z.ZodNumber;
        months: z.ZodNumber;
        startDate: z.ZodString;
        remaining: z.ZodOptional<z.ZodNumber>;
        status: z.ZodOptional<z.ZodEnum<["ACTIVE", "PENDING", "COMPLETED", "DEFAULTED", "CANCELLED"]>>;
        imeiNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        phone: string;
        monthly: number;
        totalAmount: number;
        downPayment: number;
        months: number;
        startDate: string;
        customerName: string;
        productName: string;
        status?: "ACTIVE" | "PENDING" | "COMPLETED" | "DEFAULTED" | "CANCELLED" | undefined;
        cnic?: string | undefined;
        area?: string | undefined;
        imeiNumber?: string | undefined;
        remaining?: number | undefined;
    }, {
        phone: string;
        monthly: number;
        totalAmount: number;
        downPayment: number;
        months: number;
        startDate: string;
        customerName: string;
        productName: string;
        status?: "ACTIVE" | "PENDING" | "COMPLETED" | "DEFAULTED" | "CANCELLED" | undefined;
        cnic?: string | undefined;
        area?: string | undefined;
        imeiNumber?: string | undefined;
        remaining?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    rows: {
        phone: string;
        monthly: number;
        totalAmount: number;
        downPayment: number;
        months: number;
        startDate: string;
        customerName: string;
        productName: string;
        status?: "ACTIVE" | "PENDING" | "COMPLETED" | "DEFAULTED" | "CANCELLED" | undefined;
        cnic?: string | undefined;
        area?: string | undefined;
        imeiNumber?: string | undefined;
        remaining?: number | undefined;
    }[];
}, {
    rows: {
        phone: string;
        monthly: number;
        totalAmount: number;
        downPayment: number;
        months: number;
        startDate: string;
        customerName: string;
        productName: string;
        status?: "ACTIVE" | "PENDING" | "COMPLETED" | "DEFAULTED" | "CANCELLED" | undefined;
        cnic?: string | undefined;
        area?: string | undefined;
        imeiNumber?: string | undefined;
        remaining?: number | undefined;
    }[];
}>;
export type ImportInstallmentRow = z.infer<typeof importInstallmentRowSchema>;
export type ImportInstallmentsInput = z.infer<typeof importInstallmentsSchema>;
export declare const updateInstallmentSchema: z.ZodObject<{
    totalAmount: z.ZodOptional<z.ZodNumber>;
    downPayment: z.ZodOptional<z.ZodNumber>;
    monthly: z.ZodOptional<z.ZodNumber>;
    months: z.ZodOptional<z.ZodNumber>;
    startDate: z.ZodOptional<z.ZodString>;
    imeiNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cashPrice: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    profitMarkup: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    paymentFrequency: z.ZodOptional<z.ZodEnum<["monthly", "daily"]>>;
    paymentDueDay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    monthly?: number | undefined;
    totalAmount?: number | undefined;
    downPayment?: number | undefined;
    months?: number | undefined;
    startDate?: string | undefined;
    imeiNumber?: string | null | undefined;
    cashPrice?: number | null | undefined;
    profitMarkup?: number | null | undefined;
    paymentFrequency?: "daily" | "monthly" | undefined;
    paymentDueDay?: number | undefined;
}, {
    monthly?: number | undefined;
    totalAmount?: number | undefined;
    downPayment?: number | undefined;
    months?: number | undefined;
    startDate?: string | undefined;
    imeiNumber?: string | null | undefined;
    cashPrice?: number | null | undefined;
    profitMarkup?: number | null | undefined;
    paymentFrequency?: "daily" | "monthly" | undefined;
    paymentDueDay?: number | undefined;
}>;
export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;
