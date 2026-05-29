'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useIsClient } from '@/hooks/useIsClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Props {
  children: React.ReactNode;
}

/**
 * AuthGuard — protects dashboard routes.
 *
 * WHY the `hasMounted` pattern:
 *   Zustand `persist` rehydrates from localStorage synchronously on the
 *   client. On the server there is no localStorage, so `isAuthenticated`
 *   defaults to `false`. Without the mount gate, the server renders `null`
 *   while the client (after rehydration) tries to render children — a React 19
 *   hydration mismatch that throws and produces a white screen.
 *
 *   By returning a spinner until after the first client paint (`hasMounted`),
 *   both server and client agree on the initial output. After the effect fires
 *   (post-hydration), we read the real auth state and either show content or
 *   redirect — with no hydration conflict.
 */
export function AuthGuard({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  // useSyncExternalStore-based mount gate — false on server + first client
  // render, true after hydration — without the set-state-in-effect antipattern.
  const hasMounted = useIsClient();

  useEffect(() => {
    if (hasMounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasMounted, isAuthenticated, router]);

  // Pre-hydration: render a spinner so server and client agree on output.
  if (!hasMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Post-hydration: not authenticated → show nothing while redirect fires.
  if (!isAuthenticated) return null;

  return <>{children}</>;
}

/**
 * GuestGuard — protects auth pages (login/register) from authenticated users.
 *
 * Same `hasMounted` pattern for the same hydration reason.
 */
export function GuestGuard({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  // useSyncExternalStore-based mount gate — false on server + first client
  // render, true after hydration — without the set-state-in-effect antipattern.
  const hasMounted = useIsClient();

  useEffect(() => {
    if (hasMounted && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [hasMounted, isAuthenticated, router]);

  // Pre-hydration: match the server's output (children = login form).
  if (!hasMounted) return <>{children}</>;

  // Post-hydration: authenticated user → show nothing while redirect fires.
  if (isAuthenticated) return null;

  return <>{children}</>;
}
