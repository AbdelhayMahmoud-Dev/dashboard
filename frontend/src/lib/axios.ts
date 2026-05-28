import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { classifyError } from '@/types/api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const IS_DEV   = process.env.NODE_ENV !== 'production';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,      // Required for HttpOnly refresh-token cookie
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Attach the access token from the Zustand store (persisted in localStorage
// via the persist middleware — single source of truth, no double-write).
// In dev, also stamp a high-res start time so the response interceptor can
// log request duration.
type TimedRequestConfig = InternalAxiosRequestConfig & { metadata?: { startTime: number } };

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  if (IS_DEV) {
    (config as TimedRequestConfig).metadata = { startTime: performance.now() };
  }
  return config;
});

// ── Dev-only structured logger ────────────────────────────────────────────────
function devLog(level: 'log' | 'warn' | 'error', icon: string, message: string, detail?: object) {
  if (!IS_DEV || typeof window === 'undefined') return;
  // eslint-disable-next-line no-console
  console[level](`%c${icon} ${message}`, 'color: #6b7280; font-weight: 500;', detail ?? '');
}

function durationOf(config: InternalAxiosRequestConfig | undefined): string {
  const start = (config as TimedRequestConfig | undefined)?.metadata?.startTime;
  if (start === undefined) return '—';
  return `${Math.round(performance.now() - start)}ms`;
}

// ── Response interceptor ─────────────────────────────────────────────────────
let isRefreshing = false;
type FailedRequest = { resolve: (token: string) => void; reject: (error: unknown) => void };
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

/**
 * Hard logout — clears Zustand store and forces a full navigation to /login.
 * Using window.location.replace (not Next.js router) intentionally: the router
 * may not be available outside React tree and we want to purge all React state.
 */
const forceLogout = () => {
  useAuthStore.getState().clearAuth();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
};

api.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      devLog('log', '←', `${response.config.method?.toUpperCase()} ${response.config.url} ${response.status} (${durationOf(response.config)})`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (IS_DEV) {
      const kind   = classifyError(error);
      const status = error.response?.status ?? '—';
      const url    = `${originalRequest?.method?.toUpperCase() ?? '?'} ${originalRequest?.url ?? '?'}`;
      const icon   = kind === 'offline' || kind === 'timeout' ? '⚠' : '✗';
      devLog(
        kind === 'offline' || kind === 'server-error' ? 'error' : 'warn',
        icon,
        `${url} → ${status} [${kind}] (${durationOf(originalRequest)})`,
        { code: error.code, message: error.message },
      );
    }

    // Avoid infinite loop: if the refresh endpoint itself returns 401, log out.
    if (originalRequest?.url?.includes('/auth/refresh-token')) {
      forceLogout();
      return Promise.reject(error);
    }

    // Only attempt token refresh on 401 Unauthorized (not 403 Forbidden, etc.)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If another request is already refreshing, queue this one.
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use a plain axios call (not `api`) to avoid interceptor recursion.
        const { data } = await axios.post<{ data: { accessToken: string } }>(
          `${BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newToken = data.data.accessToken;

        // Update the Zustand store — the persist middleware writes to localStorage.
        useAuthStore.setState((s) => ({ ...s, accessToken: newToken }));

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
