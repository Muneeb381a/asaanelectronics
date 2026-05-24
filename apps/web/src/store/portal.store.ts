import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PortalSession {
  token: string;
  customerId: string;
  name: string;
  shopName: string;
}

interface PortalStore {
  session: PortalSession | null;
  login:   (s: PortalSession) => void;
  logout:  () => void;
}

export const usePortalStore = create<PortalStore>()(
  persist(
    (set) => ({
      session: null,
      login:  (s) => { localStorage.setItem('portal_token', s.token); set({ session: s }); },
      logout: ()  => { localStorage.removeItem('portal_token'); set({ session: null }); },
    }),
    { name: 'portal-session', partialize: (s) => ({ session: s.session }) },
  ),
);
