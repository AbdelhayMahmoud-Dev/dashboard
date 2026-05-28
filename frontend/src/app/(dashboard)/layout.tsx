// Dashboard pages are user-session-dependent — skip static generation.
// Same workStore invariant workaround as global-error.tsx and not-found.tsx.
// NOTE: 'use client' was removed so this segment config export is honoured.
export const dynamic = 'force-dynamic';

import { AuthGuard } from '@/components/providers/AuthGuard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardShell } from './_components/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TooltipProvider>
        <DashboardShell>
          {children}
        </DashboardShell>
      </TooltipProvider>
    </AuthGuard>
  );
}
