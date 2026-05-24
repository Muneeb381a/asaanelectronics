import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StaffPermissions } from '../api/staff.api.ts';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  sellerId: string | null;
  permissions?: StaffPermissions | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  setPermissions: (permissions: StaffPermissions | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('refresh_token', refreshToken);
        set({ user, accessToken });
      },
      setAccessToken: (accessToken) => set({ accessToken }),
      setPermissions: (permissions) =>
        set((s) => ({ user: s.user ? { ...s.user, permissions } : null })),
      clearAuth: () => {
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null });
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user }) },
  ),
);
