import { api } from './client.ts';

export type VehicleType = 'BIKE' | 'RICKSHAW' | 'LOADER_RICKSHAW' | 'ELECTRIC_BIKE' | 'ELECTRIC_RICKSHAW';
export type VehicleCondition = 'NEW' | 'USED';
export type VehicleStockStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD_INSTALLMENT' | 'SOLD_CASH';

export interface VehicleStock {
  id:                 string;
  sellerId:           string;
  vehicleType:        VehicleType;
  brand:              string;
  model:              string;
  year:               number | null;
  color:              string | null;
  engineNumber:       string;
  chassisNumber:      string;
  registrationNumber: string | null;
  condition:          VehicleCondition;
  purchasePrice:      string | null;
  sellingPrice:       string | null;
  status:             VehicleStockStatus;
  supplierName:       string | null;
  notes:              string | null;
  photoUrl:           string | null;
  purchasedAt:        string | null;
  soldAt:             string | null;
  createdAt:          string;
  updatedAt:          string;
}

export interface VehicleStockStats {
  total:           number;
  available:       number;
  reserved:        number;
  soldInstallment: number;
  soldCash:        number;
}

export interface CreateVehicleStockInput {
  vehicleType:         VehicleType;
  brand:               string;
  model:               string;
  year?:               number;
  color?:              string;
  engineNumber:        string;
  chassisNumber:       string;
  registrationNumber?: string;
  condition?:          VehicleCondition;
  purchasePrice?:      number;
  sellingPrice?:       number;
  supplierName?:       string;
  notes?:              string;
  purchasedAt?:        string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const vehicleStockApi = {
  list: (params?: {
    page?: number; limit?: number;
    status?: string; vehicleType?: string;
    search?: string; condition?: string;
  }) =>
    api.get<{ data: { data: VehicleStock[]; total: number; page: number; limit: number } }>(
      '/vehicle-stock', { params },
    ).then(unwrap<{ data: VehicleStock[]; total: number; page: number; limit: number }>),

  stats: () =>
    api.get<{ data: VehicleStockStats }>('/vehicle-stock/stats').then(unwrap<VehicleStockStats>),

  getOne: (id: string) =>
    api.get<{ data: VehicleStock }>(`/vehicle-stock/${id}`).then(unwrap<VehicleStock>),

  create: (body: CreateVehicleStockInput) =>
    api.post<{ data: VehicleStock }>('/vehicle-stock', body).then(unwrap<VehicleStock>),

  update: (id: string, body: Partial<CreateVehicleStockInput> & { status?: VehicleStockStatus }) =>
    api.patch<{ data: VehicleStock }>(`/vehicle-stock/${id}`, body).then(unwrap<VehicleStock>),

  delete: (id: string) =>
    api.delete(`/vehicle-stock/${id}`),
};
