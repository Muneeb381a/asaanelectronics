import { z } from 'zod';
export declare const createSupplierSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    iban: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone?: string | undefined;
    address?: string | undefined;
    notes?: string | undefined;
    iban?: string | undefined;
}, {
    name: string;
    phone?: string | undefined;
    address?: string | undefined;
    notes?: string | undefined;
    iban?: string | undefined;
}>;
export declare const updateSupplierSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    iban: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    notes?: string | undefined;
    iban?: string | undefined;
}, {
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    notes?: string | undefined;
    iban?: string | undefined;
}>;
export declare const createSupplierInvoiceSchema: z.ZodObject<{
    totalAmount: z.ZodOptional<z.ZodNumber>;
    paidAmount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    invoiceDate: z.ZodString;
    lines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    totalAmount: z.ZodOptional<z.ZodNumber>;
    paidAmount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    invoiceDate: z.ZodString;
    lines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    totalAmount: z.ZodOptional<z.ZodNumber>;
    paidAmount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    invoiceDate: z.ZodString;
    lines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        productId: z.ZodOptional<z.ZodString>;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateInvoicePaidSchema: z.ZodObject<{
    paidAmount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    paidAmount: number;
}, {
    paidAmount: number;
}>;
