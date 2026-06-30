import { api } from './client.ts';

export type SearchCustomer = {
  id: string;
  name: string;
  phone: string;
  area: string | null;
  cnicMasked: string;
  isBlacklisted: boolean;
  lifecycleStage: string;
};

export type SearchInstallment = {
  id: string;
  invoiceNumber: string | null;
  totalAmount: string;
  remaining: string;
  monthly: string;
  status: string;
  imeiNumber: string | null;
  paymentFrequency: string;
  customerName: string;
  customerPhone: string;
  customerId: string;
  productName: string;
};

export type SearchProduct = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  price: string;
  stock: number;
  serial: string | null;
  category: string | null;
};

export type SearchResults = {
  customers:    SearchCustomer[];
  installments: SearchInstallment[];
  products:     SearchProduct[];
};

export const searchApi = {
  search: (q: string): Promise<SearchResults> =>
    api.get(`/search?q=${encodeURIComponent(q)}`).then((r) => r.data.data),
};
