import { api } from './client.ts';
import type { StaffPermissions } from './staff.api.ts';

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  sellerId: string | null;
  permissions: StaffPermissions | null;
  createdAt: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const profileApi = {
  getMe: () =>
    api.get<{ data: ProfileUser }>('/profile').then(unwrap<ProfileUser>),

  update: (data: { name?: string; email?: string }) =>
    api.put<{ data: ProfileUser }>('/profile', data).then(unwrap<ProfileUser>),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/profile/password', data),
};
