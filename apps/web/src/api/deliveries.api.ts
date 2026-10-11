import { api } from './client.ts';

export type DeliveryStatus = 'PENDING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED' | 'CANCELLED';

export interface Delivery {
  id:               string;
  sellerId:         string;
  saleType:         'CASH' | 'INSTALLMENT';
  cashSaleId:       string | null;
  installmentId:    string | null;
  slipNumber:       string;
  customerName:     string;
  customerPhone:    string | null;
  deliveryAddress:  string;
  productName:      string;
  quantity:         number;
  serialSnapshot:   string | null;
  driverUserId:     string | null;
  driverName:       string;
  driverPhone:      string | null;
  status:           DeliveryStatus;
  scheduledDate:    string | null;
  dispatchedAt:     string | null;
  deliveredAt:      string | null;
  signatureUrl:     string | null;
  proofPhotoUrl:    string | null;
  conditionNote:    string | null;
  rejectionReason:  string | null;
  stockReversed:    boolean;
  createdByUserId:  string | null;
  createdAt:        string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const deliveriesApi = {
  list: (status?: DeliveryStatus) =>
    api.get<{ data: Delivery[] }>('/deliveries', { params: status ? { status } : undefined }).then(unwrap<Delivery[]>),

  listDrivers: () =>
    api.get<{ data: { id: string; name: string }[] }>('/deliveries/drivers').then(unwrap<{ id: string; name: string }[]>),

  create: (body: {
    saleType: 'CASH' | 'INSTALLMENT'; saleId: string; deliveryAddress: string;
    driverUserId?: string; driverName?: string; driverPhone?: string; scheduledDate?: string;
  }) =>
    api.post<{ data: Delivery }>('/deliveries', body).then(unwrap<Delivery>),

  dispatch: (id: string) =>
    api.patch<{ data: Delivery }>(`/deliveries/${id}/dispatch`).then(unwrap<Delivery>),

  markDelivered: (id: string, body: { signatureUrl?: string; proofPhotoUrl?: string; conditionNote?: string }) =>
    api.patch<{ data: Delivery }>(`/deliveries/${id}/delivered`, body).then(unwrap<Delivery>),

  markRejected: (id: string, body: { rejectionReason: string; proofPhotoUrl?: string }) =>
    api.patch<{ data: Delivery }>(`/deliveries/${id}/rejected`, body).then(unwrap<Delivery>),

  markStockReversed: (id: string) =>
    api.patch<{ data: Delivery }>(`/deliveries/${id}/stock-reversed`).then(unwrap<Delivery>),

  cancel: (id: string) =>
    api.patch<{ data: Delivery }>(`/deliveries/${id}/cancel`).then(unwrap<Delivery>),

  // Shared by the signature pad (canvas blob) and the "upload photo" fallback —
  // same /api/upload endpoint the rest of the app uses for CNIC/customer photos.
  uploadProof: async (fileOrBlob: Blob, filename = 'proof.png') => {
    const fd = new FormData();
    fd.append('file', fileOrBlob, filename);
    fd.append('folder', 'assaan/deliveries');
    const res = await api.post<{ data: { url: string } }>('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.url;
  },
};
