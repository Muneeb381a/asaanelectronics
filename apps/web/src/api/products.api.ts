import type { CreateProductInput, UpdateProductInput } from '@assaan/shared';
import { api } from './client.ts';

export interface Product {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  price: string;
  installmentPrice: string | null;
  purchasePrice: string | null;
  stock: number;
  minStock: number;
  photoUrl: string | null;
  serial: string | null;
  warrantyMonths: number | null;
  description: string | null;
  sellerId: string;
}

interface ListResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface FastMovingItem   { id: string; name: string; stock: number; salesLast30: number; trendPct: number | null }
export interface SlowMovingItem   { id: string; name: string; stock: number; daysSinceLastSale: number | null; severity: 'CRITICAL' | 'WARNING' }
export interface ForecastItem     { id: string; name: string; stock: number; predicted30: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; salesLast30: number }
export interface ReorderItem      { id: string; name: string; stock: number; predicted30: number; suggestedQty: number; priority: 'URGENT' | 'SOON'; purchasePrice: string | null }

export interface InventoryIntelligence {
  fastMoving:         FastMovingItem[];
  slowMoving:         SlowMovingItem[];
  demandForecast:     ForecastItem[];
  reorderSuggestions: ReorderItem[];
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const productsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ data: ListResponse }>('/products', { params }).then(unwrap<ListResponse>),

  create: (data: CreateProductInput) =>
    api.post<{ data: Product }>('/products', data).then(unwrap<Product>),

  update: (id: string, data: UpdateProductInput) =>
    api.patch<{ data: Product }>(`/products/${id}`, data).then(unwrap<Product>),

  remove: (id: string) =>
    api.delete(`/products/${id}`),

  getIntelligence: () =>
    api.get<{ data: InventoryIntelligence }>('/products/intelligence').then(unwrap<InventoryIntelligence>),
};
