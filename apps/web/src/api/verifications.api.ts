import { api } from './client.ts';

export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export type VerificationReport = {
  id: string;
  customerId: string;
  avoId: string;
  status: 'APPROVED' | 'REJECTED';
  addressVerified: boolean;
  employerVerified: boolean;
  guarantor1Reachable: boolean;
  guarantor2Reachable: boolean;
  photoEvidenceUrl: string | null;
  notes: string | null;
  latitude: string | null;
  longitude: string | null;
  locationAccuracy: string | null;
  createdAt: string;
  avo: { id: string; name: string; email: string } | null;
};

export type AvoStat = {
  id: string;
  name: string;
  total: number;
  approved: number;
  rejected: number;
  defaults: number;
};

export type QueueCustomer = {
  id: string;
  name: string;
  cnicMasked: string;
  phone: string;
  address: string | null;
  occupation: string | null;
  employer: string | null;
  verificationStatus: VerificationStatus;
  photoUrl: string | null;
  createdAt: string;
};

export const verificationsApi = {
  myQueue: () =>
    api.get<{ data: { data: QueueCustomer[]; total: number; page: number; limit: number } }>('/verifications/my-queue')
      .then((r) => r.data.data),

  submit: (customerId: string, body: {
    status: 'APPROVED' | 'REJECTED';
    addressVerified: boolean;
    employerVerified: boolean;
    guarantor1Reachable: boolean;
    guarantor2Reachable: boolean;
    photoEvidenceUrl?: string;
    notes?: string;
    latitude: number;
    longitude: number;
    locationAccuracy: number;
  }) => api.post(`/verifications/customers/${customerId}`, body).then((r) => r.data),

  getReport: (customerId: string) =>
    api.get<{ data: VerificationReport | null }>(`/verifications/customers/${customerId}/report`).then((r) => r.data.data),

  avoStats: () =>
    api.get<{ data: AvoStat[] }>('/verifications/avo-stats').then((r) => r.data.data),

  assignAvo: (customerId: string, avoId: string) =>
    api.patch(`/customers/${customerId}/assign-avo`, { avoId }).then((r) => r.data),

  reVerify: (customerId: string) =>
    api.post(`/verifications/customers/${customerId}/re-verify`).then((r) => r.data),
};
