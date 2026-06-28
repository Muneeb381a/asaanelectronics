import type { CreateCustomerInput, UpdateCustomerInput } from '@assaan/shared';
import { api } from './client.ts';

export type RiskLabel      = 'GOOD' | 'AVERAGE' | 'RISKY' | 'BLACKLIST';
export type LifecycleStage = 'LEAD' | 'VERIFIED' | 'ACTIVE' | 'AT_RISK' | 'DEFAULT' | 'CLOSED' | 'REPEAT';
export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface Customer {
  id: string;
  name: string;
  cnicMasked: string;
  phone: string;
  fatherName: string | null;
  cnicExpiry: string | null;
  address: string | null;
  area: string | null;
  officeAddress: string | null;
  salary: string | null;
  occupation: string | null;
  employer: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  guarantorCnic: string | null;
  guarantorAddress: string | null;
  guarantorRelation: string | null;
  guarantorCnicFrontUrl: string | null;
  guarantorCnicBackUrl: string | null;
  guarantor2Name: string | null;
  guarantor2Phone: string | null;
  guarantor2Cnic: string | null;
  guarantor2Address: string | null;
  guarantor2Relation: string | null;
  guarantor2CnicFrontUrl: string | null;
  guarantor2CnicBackUrl: string | null;
  photoUrl: string | null;
  cnicFrontUrl: string | null;
  cnicBackUrl: string | null;
  blankChequeUrl: string | null;
  chequeBank: string | null;
  chequeAccountNo: string | null;
  chequeNo: string | null;
  customerType: string | null;
  shopName: string | null;
  verificationStatus: VerificationStatus;
  assignedAvoId: string | null;
  createdByUserId: string | null;
  sellerId: string;
  createdAt: string;
  riskScore: number;
  riskLabel: RiskLabel;
  lifecycleStage: LifecycleStage;
  tags: string[];
  dob: string | null;
}

interface ListResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

export interface BureauShop {
  shopName: string;
  activeCount: number;
  defaultedCount: number;
  completedCount: number;
  cancelledCount: number;
  totalRemaining: string;
}

export interface BureauData {
  totalActive: number;
  totalDefaulted: number;
  totalCompleted: number;
  totalRemaining: string;
  shops: BureauShop[];
}

export interface LookupResponse {
  ownRecord: CustomerLookupResult | null;
  bureau: BureauData | null;
}

export interface CustomerLookupInstallment {
  id: string;
  status: string;
  totalAmount: string;
  downPayment: string;
  remaining: string;
  monthly: string;
  months: number;
  startDate: string;
  createdAt: string;
  productName: string;
  productId: string;
}

export interface CustomerLookupResult {
  id: string;
  name: string;
  cnicMasked: string;
  phone: string;
  address: string | null;
  officeAddress: string | null;
  occupation: string | null;
  employer: string | null;
  salary: string | null;
  fatherName: string | null;
  cnicExpiry: string | null;
  photoUrl: string | null;
  verificationStatus: string;
  createdAt: string;
  riskScore: number;
  riskLabel: 'GOOD' | 'AVERAGE' | 'RISKY' | 'BLACKLIST';
  lifecycleStage: string;
  installments: CustomerLookupInstallment[];
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const customersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; lifecycle?: string; verificationStatus?: string; sortBy?: string; sortDir?: string; scope?: 'shop'; tag?: string }) =>
    api.get<{ data: ListResponse }>('/customers', { params }).then(unwrap<ListResponse>),

  lifecycleCounts: () =>
    api.get<{ data: { data: Record<string, number> } }>('/customers/lifecycle-counts').then((r) => r.data.data),

  getOne: (id: string) =>
    api.get<{ data: Customer }>(`/customers/${id}`).then(unwrap<Customer>),

  create: (data: CreateCustomerInput) =>
    api.post<{ data: Customer }>('/customers', data).then(unwrap<Customer>),

  update: (id: string, data: UpdateCustomerInput) =>
    api.patch<{ data: Customer }>(`/customers/${id}`, data).then(unwrap<Customer>),

  remove: (id: string) =>
    api.delete(`/customers/${id}`),

  lookup: (cnic: string) =>
    api.get<{ data: LookupResponse }>('/customers/lookup', { params: { cnic } }).then(unwrap<LookupResponse>),

  getRiskBreakdown: (id: string) =>
    api.get<{ data: {
      total: number;
      label: string;
      factors: Record<string, { score: number; max: number; label: string }>;
    } }>(`/customers/${id}/risk-breakdown`).then((r) => r.data.data),

  getUpcomingBirthdays: () =>
    api.get<{ data: { data: Array<{ id: string; name: string; phone: string; dob: string; area: string | null; photoUrl: string | null }> } }>('/customers/upcoming-birthdays').then((r) => r.data.data.data),
};
