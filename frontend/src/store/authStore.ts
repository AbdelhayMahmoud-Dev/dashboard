import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        // Single source of truth: Zustand persist handles localStorage via
        // the partialize below. The axios interceptor reads from here too.
        set({ user, accessToken, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      clearAuth: () => {
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => localStorage),
      // SECURITY: we deliberately do NOT persist the access token. A short-lived
      // access token in localStorage is exfiltratable by any XSS payload. Instead
      // we persist only the (non-secret) user profile + the authenticated flag so
      // the UI can render instantly on reload without a redirect flash. The access
      // token lives in memory only; on reload it's null, and the first API call
      // 401s → the axios interceptor silently mints a fresh one from the HttpOnly
      // refresh cookie and retries. The refresh token never touches JS.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
