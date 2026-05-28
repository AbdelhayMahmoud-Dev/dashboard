import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { config } from '@/config';

function onQueryError(error: unknown) {
  // 401 errors are handled by the axios interceptor (token refresh / force-logout).
  // Suppress them here to avoid double-handling.
  const err = error as { response?: { status?: number } };
  if (err?.response?.status === 401) return;
}

/**
 * Factory — call once per browser session (inside a React useState initialiser).
 *
 * WHY a factory instead of a module-level singleton:
 *   In a production Next.js deployment the server process is long-lived.
 *   A module-level singleton is shared across every incoming SSR request,
 *   meaning cached query data can bleed between different users' sessions.
 *   Creating the QueryClient inside `useState(() => makeQueryClient())` in
 *   the Providers component gives each browser session its own isolated cache
 *   while the initialiser syntax ensures only one instance per mount.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onQueryError }),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: config.queryStaleTime,       // 5 min
        gcTime: config.queryCacheTime,          // 10 min
        retry: (failureCount, error) => {
          const err = error as { response?: { status?: number } };
          // Never retry auth or permission errors — they won't self-heal.
          if (err?.response?.status === 401 || err?.response?.status === 403) return false;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
