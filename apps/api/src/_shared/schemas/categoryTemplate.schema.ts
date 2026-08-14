import { z } from 'zod';

const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const fieldDefinitionSchema = z.object({
  key:         z.string().min(1).max(100),
  column:      z.string().optional(),
  label:       z.string().min(1).max(100),
  type:        z.enum(['text', 'number', 'select', 'boolean']),
  options:     z.array(fieldOptionSchema).optional(),
  placeholder: z.string().optional(),
  required:    z.boolean().optional(),
});

export const createCategoryTemplateSchema = z.object({
  categoryName: z.string().min(1).max(100),
  fields:       z.array(fieldDefinitionSchema).min(1).max(30),
});

export type FieldDefinitionInput = z.infer<typeof fieldDefinitionSchema>;
export type CreateCategoryTemplateInput = z.infer<typeof createCategoryTemplateSchema>;
