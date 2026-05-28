'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Resolves the backend `/health` URL from `NEXT_PUBLIC_API_URL`.
 * Because `/health` is mounted at the API root (not under `/api/v1`), we
 * extract just the origin from the configured base URL.
 */
function getHealthUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  try {
    return new URL('/health', base).toString();
  } catch {
    return 'http://localhost:5000/health';
  }
}

async function probeHealth(url: string): Promise<true> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const r = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Renders nothing while the backend is reachable. When the `/health` probe fails,
 * shows an actionable banner with the URL we tried and a Retry button.
 *
 * Mounted on the auth pages so users hitting the registration "Cannot reach the
 * server" path see a clear, immediate diagnosis instead of staring at a generic toast.
 */
export function BackendHealthBanner() {
  const url = getHealthUrl();

  const { isError, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['backend-health', url],
    queryFn:  () => probeHealth(url),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Healthy or first-load — show nothing.
  if (isLoading || !isError) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-amber-100 backdrop-blur-sm shadow-lg"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Backend appears offline</p>
          <p className="text-xs text-amber-100/75 mt-0.5 break-all">
            {IS_DEV ? (
              <>
                Couldn&apos;t reach{' '}
                <code className="font-mono text-[11px] bg-amber-500/15 rounded px-1 py-0.5">
                  {url}
                </code>
                . Start the backend with{' '}
                <code className="font-mono text-[11px] bg-amber-500/15 rounded px-1 py-0.5">
                  npm run dev:backend
                </code>
                {' '}and retry.
              </>
            ) : (
              <>Couldn&apos;t reach our servers. Check your connection and try again.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/15 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          aria-label="Retry health check"
        >
          <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
          Retry
        </button>
      </div>
    </div>
  );
}
