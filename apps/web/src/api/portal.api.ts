import axios from 'axios';

const portalClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
});

portalClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type LifecycleStage     = 'LEAD' | 'VERIFIED' | 'ACTIVE' | 'AT_RISK' | 'DEFAULT' | 'CLOSED' | 'REPEAT';
export type InstallmentStatus  = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';

export interface PortalCustomer {
  id: string;
  name: string;
  cnicMasked: string;
  phone: string;
  address: string | null;
  occupation: string | null;
  employer: string | null;
  verificationStatus: VerificationStatus;
  guarantorName: string | null;
  guarantorPhone: string | null;
  guarantor2Name: string | null;
  guarantor2Phone: string | null;
  photoUrl: string | null;
  createdAt: string;
  lifecycleStage: LifecycleStage;
  totalPaid: number;
  totalRemaining: number;
  activeCount: number;
  nextDue: string | null;
  shopName: string;
  creditScore: number;
}

export interface PortalInstallment {
  id: string;
  invoiceNumber: string | null;
  productName: string;
  productBrand: string | null;
  totalAmount: number;
  downPayment: number;
  monthly: number;
  months: number;
  remaining: number;
  status: InstallmentStatus;
  startDate: string;
  dueDate: string;
  paidMonths: number;
  totalMonths: number;
  progressPct: number;
  amountPaid: number;
}

export interface PortalPayment {
  id: string;
  amount: string;
  paidOn: string;
  method: string;
  note: string | null;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const portalApi = {
  login: (cnic: string, phone: string) =>
    portalClient
      .post<{ data: { token: string; customer: Pick<PortalCustomer, 'id' | 'name' | 'cnicMasked' | 'phone' | 'verificationStatus'>; shopName: string } }>('/portal/login', { cnic, phone })
      .then(unwrap),

  me: () =>
    portalClient.get<{ data: PortalCustomer }>('/portal/me').then(unwrap<PortalCustomer>),

  installments: () =>
    portalClient.get<{ data: PortalInstallment[] }>('/portal/installments').then(unwrap<PortalInstallment[]>),

  payments: (installmentId: string) =>
    portalClient.get<{ data: PortalPayment[] }>(`/portal/installments/${installmentId}/payments`).then(unwrap<PortalPayment[]>),
};
