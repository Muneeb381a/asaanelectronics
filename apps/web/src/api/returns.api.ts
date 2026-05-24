import { api } from './client.ts';

export type ReturnType      = 'RETURN' | 'EXCHANGE' | 'WARRANTY_REPLACEMENT';
export type ReturnReason    = 'DEFECTIVE' | 'DAMAGED_IN_USE' | 'WRONG_ITEM' | 'CUSTOMER_REQUEST' | 'WARRANTY_CLAIM' | 'OTHER';
export type ReturnCondition = 'GOOD' | 'DAMAGED' | 'UNUSABLE';
export type ReturnStatus    = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type ResolutionType  = 'RESALE' | 'DAMAGED_WRITE_OFF' | 'REPLACEMENT_SENT';

export interface Return {
  id: string;
  type: ReturnType;
  reason: ReturnReason;
  condition: ReturnCondition;
  status: ReturnStatus;
  resolutionType: ResolutionType | null;
  refundAmount: string | null;
  notes: string | null;
  installmentId: string | null;
  replacementProductId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  customerName: string;
  customerPhone: string;
  productName: string;
}

export interface CreateReturnBody {
  customerId: string;
  productId: string;
  installmentId?: string;
  type: ReturnType;
  reason: ReturnReason;
  condition: ReturnCondition;
  notes?: string;
}

export interface ResolveBody {
  status: 'APPROVED' | 'REJECTED';
  resolutionType?: ResolutionType;
  replacementProductId?: string;
  refundAmount?: number;
  notes?: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const returnsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; customerId?: string }) =>
    api.get<{ data: { data: Return[]; total: number; page: number; limit: number } }>('/returns', { params })
      .then(unwrap<{ data: Return[]; total: number; page: number; limit: number }>),

  create: (body: CreateReturnBody) =>
    api.post<{ data: Return }>('/returns', body).then(unwrap<Return>),

  resolve: (id: string, body: ResolveBody) =>
    api.patch<{ data: Return }>(`/returns/${id}/resolve`, body).then(unwrap<Return>),
};
