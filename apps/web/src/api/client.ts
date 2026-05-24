import axios from 'axios';
import { useAuthStore } from '../store/auth.store.ts';

const BASE = import.meta.env.VITE_API_URL as string;

export const api = axios.create({ baseURL: BASE });

const SIGNING_SECRET = import.meta.env.VITE_REQUEST_SIGNING_SECRET as string | undefined;

async function signRequest(method: string, path: string): Promise<Record<string, string>> {
  if (!SIGNING_SECRET) return {};
  const timestamp = Date.now().toString();
  const payload   = `${method.toUpperCase()}:${path}:${timestamp}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sig = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { 'X-Request-Timestamp': timestamp, 'X-Request-Signature': sig };
}

api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const sigHeaders = await signRequest(config.method ?? 'GET', config.url ?? '/');
  Object.assign(config.headers, sigHeaders);

  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err: unknown) => {
    if (!axios.isAxiosError(err) || err.response?.status !== 401) {
      return Promise.reject(err);
    }

    const isRefreshCall = err.config?.url?.includes('/auth/refresh');
    const storedToken = localStorage.getItem('refresh_token');

    if (!storedToken || isRefreshCall) {
      useAuthStore.getState().clearAuth();
      localStorage.removeItem('refresh_token');
      return Promise.reject(err);
    }

    // Deduplicate concurrent refresh calls
    if (!refreshing) {
      refreshing = axios
        .post<{ data: { accessToken: string; refreshToken: string } }>(`${BASE}/auth/refresh`, {
          token: storedToken,
        })
        .then((r) => {
          const { accessToken, refreshToken } = r.data.data;
          localStorage.setItem('refresh_token', refreshToken);
          useAuthStore.getState().setAccessToken(accessToken);
          return accessToken;
        })
        .catch((e) => {
          useAuthStore.getState().clearAuth();
          localStorage.removeItem('refresh_token');
          throw e;
        })
        .finally(() => {
          refreshing = null;
        });
    }

    try {
      const newToken = await refreshing;
      const config = err.config!;
      config.headers.Authorization = `Bearer ${newToken}`;
      return axios(config);
    } catch {
      return Promise.reject(err);
    }
  },
);
