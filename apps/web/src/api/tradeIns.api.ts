import { api } from './client.ts';

export interface TradeIn {
  id:            string;
  sellerId:      string;
  customerId:    string | null;
  installmentId: string | null;
  cashSaleId:    string | null;
  deviceName:    string;
  brand:         string | null;
  model:         string | null;
  imei:          string | null;
  color:         string | null;
  storageGb:     number | null;
  condition:     'good' | 'fair' | 'poor';
  assessedValue: string;
  notes:         string | null;
  status:        'in_stock' | 'sold' | 'disposed';
  soldPrice:     string | null;
  soldAt:        string | null;
  createdAt:     string;
  customerName:  string | null;
  customerPhone: string | null;
}

export interface TradeInStats {
  total:          number;
  in_stock:       number;
  sold:           number;
  disposed:       number;
  total_assessed: string;
  total_sold:     string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const tradeInsApi = {
  list: (params: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.page)   q.set('page',   String(params.page));
    if (params.limit)  q.set('limit',  String(params.limit));
    return api.get<{ data: { data: TradeIn[]; total: number; page: number; limit: number } }>(`/trade-ins?${q}`).then(unwrap);
  },

  stats: () =>
    api.get<{ data: TradeInStats }>('/trade-ins/stats').then(unwrap<TradeInStats>),

  create: (body: {
    customerId?: string; installmentId?: string; cashSaleId?: string;
    deviceName: string; brand?: string; model?: string; imei?: string;
    color?: string; storageGb?: number; condition: string; assessedValue: number; notes?: string;
  }) => api.post<{ data: TradeIn }>('/trade-ins', body).then(unwrap<TradeIn>),

  update: (id: string, body: {
    status?: string; soldPrice?: number; condition?: string; notes?: string; assessedValue?: number;
  }) => api.patch<{ data: TradeIn }>(`/trade-ins/${id}`, body).then(unwrap<TradeIn>),

  remove: (id: string) => api.delete(`/trade-ins/${id}`),
};
