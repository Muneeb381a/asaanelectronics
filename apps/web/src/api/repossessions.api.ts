import { api } from './client.ts';

export interface Repossession {
  id:                         string;
  sellerId:                   string;
  installmentId:              string;
  customerId:                 string | null;
  repossessedDate:            string;
  deviceName:                 string;
  imei:                       string | null;
  condition:                  'good' | 'fair' | 'poor';
  reason:                     string | null;
  amountRecovered:            string;
  outstandingAtRepossession:  string;
  assessedValue:              string | null;
  status:                     'in_stock' | 'sold' | 'disposed' | 'returned';
  soldPrice:                  string | null;
  soldAt:                     string | null;
  notes:                      string | null;
  createdAt:                  string;
  customerName:               string | null;
  customerPhone:              string | null;
}

export interface RepossessionStats {
  total:             number;
  in_stock:          number;
  sold:              number;
  disposed:          number;
  returned:          number;
  total_outstanding: string;
  total_recovered:   string;
  total_sold:        string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const repossessionsApi = {
  list: (params: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.page)   q.set('page',   String(params.page));
    if (params.limit)  q.set('limit',  String(params.limit));
    return api.get<{ data: { data: Repossession[]; total: number; page: number; limit: number } }>(`/repossessions?${q}`).then(unwrap);
  },

  stats: () =>
    api.get<{ data: RepossessionStats }>('/repossessions/stats').then(unwrap<RepossessionStats>),

  create: (body: {
    installmentId: string; repossessedDate: string; deviceName: string;
    imei?: string; condition: string; reason?: string;
    amountRecovered?: number; assessedValue?: number; notes?: string;
  }) => api.post<{ data: Repossession }>('/repossessions', body).then(unwrap<Repossession>),

  update: (id: string, body: {
    status?: string; soldPrice?: number; condition?: string; notes?: string; assessedValue?: number;
  }) => api.patch<{ data: Repossession }>(`/repossessions/${id}`, body).then(unwrap<Repossession>),

  remove: (id: string) => api.delete(`/repossessions/${id}`),
};
