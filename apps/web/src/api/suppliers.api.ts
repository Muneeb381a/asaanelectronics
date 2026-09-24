import { api } from './client.ts';

export interface Supplier {
  id:           string;
  name:         string;
  phone:        string | null;
  address:      string | null;
  iban:         string | null;
  notes:        string | null;
  createdAt:    string;
  invoiceCount: number;
  totalAmount:  number;
  paidAmount:   number;
  outstanding:  number;
}

export interface SupplierInvoiceLine {
  id:          string;
  productId:   string | null;
  productName: string;
  quantity:    number;
  unitPrice:   number;
}

export interface SupplierInvoice {
  id:            string;
  supplierId:    string;
  sellerId:      string;
  totalAmount:   number;
  paidAmount:    number;
  outstanding:   number;
  description:   string;
  invoiceDate:   string;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  dueDate:       string | null;
  createdAt:     string;
  lines:         SupplierInvoiceLine[];
}

export interface CreateInvoiceLine {
  productId?:          string;
  productName:         string;
  quantity:            number;
  unitPrice:           number;
  notes?:              string;
  // vehicle details
  chassisNumber?:      string;
  engineNumber?:       string;
  color?:              string;
  modelYear?:          number;
  vehicleCondition?:   'NEW' | 'USED';
  registrationNumber?: string;
}

export interface SupplierPayment {
  id:             string;
  amount:         number;
  method:         string | null;
  note:           string | null;
  paidOn:         string;
  createdAt:      string;
  recordedByName: string | null;
}

export interface PnLData {
  period:              string;
  installmentRevenue:  number;
  cashRevenue:         number;
  totalRevenue:        number;
  cogsSales:           number;
  grossProfit:         number;
  grossMarginPct:      number;
  totalExpenses:       number;
  netProfit:           number;
  netMarginPct:        number;
  supplierPurchases:   number;
  supplierPaid:        number;
  supplierOutstanding: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const suppliersApi = {
  list: () =>
    api.get<{ data: Supplier[] }>('/suppliers').then(unwrap<Supplier[]>),

  create: (body: { name: string; phone?: string; address?: string; iban?: string; notes?: string }) =>
    api.post<{ data: Supplier }>('/suppliers', body).then(unwrap<Supplier>),

  update: (id: string, body: Partial<{ name: string; phone: string; address: string; iban: string; notes: string }>) =>
    api.patch<{ data: Supplier }>(`/suppliers/${id}`, body).then(unwrap<Supplier>),

  remove: (id: string) => api.delete(`/suppliers/${id}`),

  listInvoices: (supplierId: string) =>
    api.get<{ data: SupplierInvoice[] }>(`/suppliers/${supplierId}/invoices`).then(unwrap<SupplierInvoice[]>),

  createInvoice: (supplierId: string, body: {
    totalAmount?: number;
    paidAmount?: number;
    description?: string;
    invoiceDate: string;
    lines?: CreateInvoiceLine[];
  }) =>
    api.post<{ data: SupplierInvoice }>(`/suppliers/${supplierId}/invoices`, body).then(unwrap<SupplierInvoice>),

  deleteInvoice: (supplierId: string, invoiceId: string) =>
    api.delete(`/suppliers/${supplierId}/invoices/${invoiceId}`),

  listPayments: (supplierId: string, invoiceId: string) =>
    api.get<{ data: SupplierPayment[] }>(`/suppliers/${supplierId}/invoices/${invoiceId}/payments`).then(unwrap<SupplierPayment[]>),

  recordPayment: (supplierId: string, invoiceId: string, body: { amount: number; method?: string; note?: string; paidOn?: string }) =>
    api.post<{ data: { payment: SupplierPayment; invoice: SupplierInvoice } }>(
      `/suppliers/${supplierId}/invoices/${invoiceId}/payments`, body,
    ).then(unwrap<{ payment: SupplierPayment; invoice: SupplierInvoice }>),

  removePayment: (supplierId: string, invoiceId: string, paymentId: string) =>
    api.delete<{ data: SupplierInvoice }>(`/suppliers/${supplierId}/invoices/${invoiceId}/payments/${paymentId}`).then(unwrap<SupplierInvoice>),

  getPnL: (year: number, month?: number) =>
    api.get<{ data: PnLData }>(`/reports/pnl?year=${year}${month ? `&month=${month}` : ''}`).then(unwrap<PnLData>),
};
