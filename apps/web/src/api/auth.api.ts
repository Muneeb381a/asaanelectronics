import type { LoginInput, RegisterInput } from '@assaan/shared';
import { api } from './client.ts';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  sellerId: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export type LoginResponse =
  | { requiresOtp: false; accessToken: string; refreshToken: string; user: AuthUser }
  | { requiresOtp: true; otpToken: string };

function unwrap<T>(res: { data: { data: T } }) {
  return res.data.data;
}

export const authApi = {
  setup: (data: RegisterInput) =>
    api.post<{ data: AuthResponse }>('/auth/setup', data).then(unwrap<AuthResponse>),

  register: (data: RegisterInput) =>
    api.post<{ data: AuthResponse }>('/auth/register', data).then(unwrap<AuthResponse>),

  login: (data: LoginInput) =>
    api.post<{ data: LoginResponse }>('/auth/login', data).then(unwrap<LoginResponse>),

  verifyOtp: (data: { otpToken: string; code: string }) =>
    api.post<{ data: AuthResponse }>('/auth/verify-otp', data).then(unwrap<AuthResponse>),

  resendOtp: (data: { otpToken: string }) =>
    api.post<{ data: { otpToken: string } }>('/auth/resend-otp', data).then(unwrap<{ otpToken: string }>),

  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data),

  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    api.post('/auth/reset-password', data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { token: refreshToken }),

  refresh: (token: string) =>
    api.post<{ data: Pick<AuthResponse, 'accessToken' | 'refreshToken'> }>('/auth/refresh', { token }).then(unwrap),
};
