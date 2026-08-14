import { api } from './client.ts';

export type UnitStatus    = 'available' | 'sold' | 'defective' | 'returned';
export type UnitCondition = 'new' | 'refurbished';
export type PtaStatus     = 'approved' | 'non_pta' | 'unknown';
export type SerialType    = 'imei' | 'serial' | 'chassis_engine';

export interface ProductUnit {
  id:            string;
  serialType:    SerialType;
  imei:          string | null;
  imei2:         string | null;
  serialNumber:  string | null;
  color:         string | null;
  storageGb:     number | null;
  condition:     UnitCondition;
  purchasePrice: string | null;
  status:        UnitStatus;
  notes:         string | null;
  ptaStatus:     PtaStatus;
  soldAt:        string | null;
  saleType:      string | null;
  soldToName:    string | null;
  productId:     string | null;
  productName:   string | null;
  productBrand:  string | null;
  createdAt:     string;
}

export interface UnitStats {
  total:     number;
  available: number;
  sold:      number;
  defective: number;
  returned:  number;
}

export interface ImeiLookupResult {
  found: boolean;
  imei:  string;
  unit?: ProductUnit;
}

export interface CreateUnitBody {
  serialType?:   SerialType;
  imei?:         string;
  imei2?:        string;
  serialNumber?: string;
  productId?:    string;
  color?:        string;
  storageGb?:    number;
  condition?:    UnitCondition;
  purchasePrice?: number;
  notes?:        string;
}

export interface BulkCreateBody {
  imeis:      string[];
  productId?: string;
  condition?: UnitCondition;
  color?:     string;
  storageGb?: number;
}

export interface UpdateUnitBody {
  status?:    UnitStatus;
  notes?:     string | null;
  color?:     string | null;
  storageGb?: number | null;
  productId?: string | null;
  condition?: UnitCondition;
  ptaStatus?: PtaStatus;
}

export const productUnitsApi = {
  list: (p: { search?: string; status?: string; productId?: string; page?: number; limit?: number }) =>
    api.get<{ data: { data: ProductUnit[]; total: number; page: number; limit: number } }>('/units', { params: p })
      .then((r) => r.data.data),

  getStats: () =>
    api.get<{ data: UnitStats }>('/units/stats').then((r) => r.data.data),

  lookup: (imei: string) =>
    api.get<{ data: ImeiLookupResult }>(`/units/lookup/${imei}`).then((r) => r.data.data),

  create: (body: CreateUnitBody) =>
    api.post<{ data: ProductUnit }>('/units', body).then((r) => r.data.data),

  bulkCreate: (body: BulkCreateBody) =>
    api.post<{ data: { created: number; skipped: string[] } }>('/units/bulk', body).then((r) => r.data.data),

  update: (id: string, body: UpdateUnitBody) =>
    api.patch<{ data: ProductUnit }>(`/units/${id}`, body).then((r) => r.data.data),

  remove: (id: string) =>
    api.delete(`/units/${id}`).then((r) => r.data),

  ptaCheck: (imei: string) =>
    api.get<{ data: { status: 'OK' | 'UNAVAILABLE'; registered?: boolean; statusMessage?: string; message?: string } }>(
      `/units/pta-check/${imei}`
    ).then((r) => r.data.data),
};
