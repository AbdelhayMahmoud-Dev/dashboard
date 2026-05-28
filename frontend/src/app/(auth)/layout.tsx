// Auth pages are user-session-dependent — skip static generation.
// Same workStore invariant workaround as global-error.tsx and not-found.tsx.
export const dynamic = 'force-dynamic';

import { GuestGuard } from '@/components/providers/AuthGuard';
import { BackendHealthBanner } from '@/components/layout/BackendHealthBanner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-600/20 blur-3xl" />
        </div>
        <div className="relative w-full max-w-md">
          <BackendHealthBanner />
          {children}
        </div>
      </div>
    </GuestGuard>
  );
}
