import { api } from './client.ts';
import type { VehicleType, VehicleCondition } from './vehicleStock.api.ts';

export type VehicleInstallmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED' | 'CLOSED';
export type PaymentMethod = 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';
export type LetterStatus = 'NONE' | 'FIRST_NOTICE' | 'SECOND_NOTICE' | 'LEGAL_NOTICE' | 'FILED';
export type BiometricStatus = 'PENDING' | 'SELLER_DONE' | 'BUYER_DONE' | 'COMPLETED' | 'NOT_REQUIRED';

export interface VehicleInstallment {
  id:                  string;
  sellerId:            string;
  vehicleId:           string;
  customerId:          string;
  totalAmount:         string;
  downPayment:         string;
  remaining:           string;
  monthly:             string;
  months:              number;
  startDate:           string;
  paymentFrequency:    string;
  paymentDueDay:       number;
  invoiceNumber:       string | null;
  status:              VehicleInstallmentStatus;
  letterStatus:        LetterStatus;
  letterSentAt:        string | null;
  biometricStatus:     BiometricStatus;
  biometricDoneAt:     string | null;
  notes:               string | null;
  createdAt:           string;
  completedAt:         string | null;
  guarantorName:       string | null;
  guarantorPhone:      string | null;
  guarantorCnic:       string | null;
  guarantorAddress:    string | null;
  guarantorRelation:   string | null;
  guarantor2Name:      string | null;
  guarantor2Phone:     string | null;
  guarantor2Cnic:      string | null;
  guarantor2Address:   string | null;
  // Vehicle
  vehicleType:         VehicleType;
  brand:               string;
  model:               string;
  year:                number | null;
  color:               string | null;
  engineNumber:        string;
  chassisNumber:       string;
  registrationNumber:  string | null;
  vehicleCondition:    VehicleCondition;
  vehiclePhotoUrl:     string | null;
  vehicleSellingPrice?: string | null;
  // Customer
  customerName:        string;
  customerPhone:       string;
  customerArea:        string | null;
  customerAddress?:    string | null;
  customerPhotoUrl:    string | null;
  customerFileNumber:  string | null;
  customerCnicMasked?: string | null;
  customerFatherName?: string | null;
}

export interface VehiclePayment {
  id:            string;
  amount:        string;
  method:        PaymentMethod;
  paidOn:        string;
  note:          string | null;
  receiptNumber: string | null;
  periodDue:     string | null;
  daysLate:      number;
  proofImageUrl: string | null;
  collectedBy:   string | null;
  deletedAt:     string | null;
  collectorName: string | null;
}

export interface VehicleInstallmentDetail extends VehicleInstallment {
  payments: VehiclePayment[];
}

export interface VehicleInstallmentStats {
  total:       number;
  pending:     number;
  active:      number;
  completed:   number;
  defaulted:   number;
  cancelled:   number;
  outstanding: number;
}

export interface CreateVehicleInstallmentInput {
  vehicleId:          string;
  customerId:         string;
  totalAmount:        number;
  downPayment:        number;
  months:             number;
  startDate:          string;
  paymentFrequency?:  'monthly' | 'weekly' | 'daily';
  paymentDueDay?:     number;
  guarantorName?:     string;
  guarantorPhone?:    string;
  guarantorCnic?:     string;
  guarantorAddress?:  string;
  guarantorRelation?: string;
  guarantor2Name?:    string;
  guarantor2Phone?:   string;
  guarantor2Cnic?:    string;
  guarantor2Address?: string;
  notes?:             string;
}

export interface RecordVehiclePaymentInput {
  amount:         number;
  method:         PaymentMethod;
  note?:          string;
  collectedBy?:   string;
  periodDue?:     string;
  daysLate?:      number;
  proofImageUrl?: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const vehicleInstallmentsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string; vehicleType?: string }) =>
    api.get<{ data: { data: VehicleInstallment[]; total: number; page: number; limit: number } }>(
      '/vehicle-installments', { params },
    ).then(unwrap<{ data: VehicleInstallment[]; total: number; page: number; limit: number }>),

  stats: () =>
    api.get<{ data: VehicleInstallmentStats }>('/vehicle-installments/stats').then(unwrap<VehicleInstallmentStats>),

  getOne: (id: string) =>
    api.get<{ data: VehicleInstallmentDetail }>(`/vehicle-installments/${id}`).then(unwrap<VehicleInstallmentDetail>),

  create: (body: CreateVehicleInstallmentInput) =>
    api.post<{ data: VehicleInstallment }>('/vehicle-installments', body).then(unwrap<VehicleInstallment>),

  recordPayment: (id: string, body: RecordVehiclePaymentInput) =>
    api.post<{ data: { payment: VehiclePayment; remaining: number; completed: boolean } }>(
      `/vehicle-installments/${id}/payment`, body,
    ).then(unwrap<{ payment: VehiclePayment; remaining: number; completed: boolean }>),

  markDefault: (id: string) =>
    api.patch<{ data: VehicleInstallment }>(`/vehicle-installments/${id}/default`).then(unwrap<VehicleInstallment>),

  cancel: (id: string) =>
    api.patch<{ data: VehicleInstallment }>(`/vehicle-installments/${id}/cancel`).then(unwrap<VehicleInstallment>),

  updateFields: (id: string, body: { letterStatus?: LetterStatus; biometricStatus?: BiometricStatus }) =>
    api.patch<{ data: VehicleInstallment }>(`/vehicle-installments/${id}/fields`, body).then(unwrap<VehicleInstallment>),

  delete: (id: string) =>
    api.delete(`/vehicle-installments/${id}`),

  deletePayment: (id: string, paymentId: string, reason?: string) =>
    api.delete(`/vehicle-installments/${id}/payment/${paymentId}`, { data: { reason } }),
};
