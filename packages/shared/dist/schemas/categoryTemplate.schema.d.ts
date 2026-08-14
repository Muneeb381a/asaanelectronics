import { z } from 'zod';
export declare const fieldDefinitionSchema: z.ZodObject<{
    key: z.ZodString;
    column: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    type: z.ZodEnum<["text", "number", "select", "boolean"]>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        label: string;
    }, {
        value: string;
        label: string;
    }>, "many">>;
    placeholder: z.ZodOptional<z.ZodString>;
    required: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "number" | "boolean" | "text" | "select";
    label: string;
    key: string;
    options?: {
        value: string;
        label: string;
    }[] | undefined;
    column?: string | undefined;
    placeholder?: string | undefined;
    required?: boolean | undefined;
}, {
    type: "number" | "boolean" | "text" | "select";
    label: string;
    key: string;
    options?: {
        value: string;
        label: string;
    }[] | undefined;
    column?: string | undefined;
    placeholder?: string | undefined;
    required?: boolean | undefined;
}>;
export declare const createCategoryTemplateSchema: z.ZodObject<{
    categoryName: z.ZodString;
    fields: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        column: z.ZodOptional<z.ZodString>;
        label: z.ZodString;
        type: z.ZodEnum<["text", "number", "select", "boolean"]>;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            label: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            value: string;
            label: string;
        }, {
            value: string;
            label: string;
        }>, "many">>;
        placeholder: z.ZodOptional<z.ZodString>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "number" | "boolean" | "text" | "select";
        label: string;
        key: string;
        options?: {
            value: string;
            label: string;
        }[] | undefined;
        column?: string | undefined;
        placeholder?: string | undefined;
        required?: boolean | undefined;
    }, {
        type: "number" | "boolean" | "text" | "select";
        label: string;
        key: string;
        options?: {
            value: string;
            label: string;
        }[] | undefined;
        column?: string | undefined;
        placeholder?: string | undefined;
        required?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    categoryName: string;
    fields: {
        type: "number" | "boolean" | "text" | "select";
        label: string;
        key: string;
        options?: {
            value: string;
            label: string;
        }[] | undefined;
        column?: string | undefined;
        placeholder?: string | undefined;
        required?: boolean | undefined;
    }[];
}, {
    categoryName: string;
    fields: {
        type: "number" | "boolean" | "text" | "select";
        label: string;
        key: string;
        options?: {
            value: string;
            label: string;
        }[] | undefined;
        column?: string | undefined;
        placeholder?: string | undefined;
        required?: boolean | undefined;
    }[];
}>;
export type FieldDefinitionInput = z.infer<typeof fieldDefinitionSchema>;
export type CreateCategoryTemplateInput = z.infer<typeof createCategoryTemplateSchema>;
