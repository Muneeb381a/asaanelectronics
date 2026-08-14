import type { CreateCategoryTemplateInput, FieldDefinitionInput } from '@assaan/shared';
import { api } from './client.ts';

export interface CategoryTemplate {
  id: string;
  sellerId: string;
  categoryName: string;
  fields: FieldDefinitionInput[];
  createdAt: string;
}

export interface TemplateListResponse {
  system: Array<{ name: string; fields: FieldDefinitionInput[]; isSystem: true }>;
  custom: CategoryTemplate[];
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const categoryTemplatesApi = {
  list: () =>
    api.get<{ data: TemplateListResponse }>('/category-templates').then(unwrap<TemplateListResponse>),

  getByCategory: (categoryName: string) =>
    api.get<{ data: FieldDefinitionInput[] | null }>(`/category-templates/by-category/${encodeURIComponent(categoryName)}`).then(unwrap<FieldDefinitionInput[] | null>),

  upsert: (data: CreateCategoryTemplateInput) =>
    api.post<{ data: CategoryTemplate }>('/category-templates', data).then(unwrap<CategoryTemplate>),

  remove: (id: string) =>
    api.delete(`/category-templates/${id}`),
};
