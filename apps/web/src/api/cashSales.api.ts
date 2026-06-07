import { api } from './client.ts';

export type PaymentMethod = 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';

export interface CashSale {
  id:            string;
  sellerId:      string;
  productId:     string;
  quantity:      number;
  amount:        string;
  method:        PaymentMethod;
  customerName:  string | null;
  customerPhone: string | null;
  imeiNumber:    string | null;
  note:          string | null;
  soldByUserId:  string | null;
  createdAt:     string;
  productName:   string;
  productCategory: string | null;
}

interface ListResponse {
  data: CashSale[];
  total: number;
  page: number;
  limit: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const cashSalesApi = {
  list: (params?: { page?: number; limit?: number; from?: string; to?: string; search?: string }) =>
    api.get<{ data: ListResponse }>('/cash-sales', { params }).then(unwrap<ListResponse>),

  create: (body: {
    productId:     string;
    quantity:      number;
    amount:        number;
    method:        PaymentMethod;
    customerName?: string;
    customerPhone?: string;
    imeiNumber?:   string;
    note?:         string;
  }) => api.post<{ data: CashSale }>('/cash-sales', body).then(unwrap<CashSale>),

  update: (id: string, body: {
    amount?:        number;
    method?:        PaymentMethod;
    customerName?:  string | null;
    customerPhone?: string | null;
    imeiNumber?:    string | null;
    note?:          string | null;
  }) => api.patch<{ data: CashSale }>(`/cash-sales/${id}`, body).then(unwrap<CashSale>),

  remove: (id: string) => api.delete(`/cash-sales/${id}`),
};
