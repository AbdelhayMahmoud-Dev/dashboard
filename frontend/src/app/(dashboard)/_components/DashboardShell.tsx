'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { KeyboardShortcutsDialog } from '@/components/layout/KeyboardShortcutsDialog';
import { LeaderHint } from '@/components/layout/LeaderHint';
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';
import { useUIStore } from '@/store/uiStore';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  useGlobalShortcuts();

  return (
    <div
      className="min-h-screen bg-background"
      // Single source of truth for the sidebar width. The Sidebar, Navbar and
      // content area all read this var. It only affects layout at `lg` and up —
      // below `lg` the sidebar is an off-canvas drawer and the content is full-width.
      style={{ '--sidebar-w': sidebarCollapsed ? '4.25rem' : '15rem' } as React.CSSProperties}
    >
      {/* Skip link — first focusable element; lets keyboard/SR users jump past
          the sidebar + navbar straight to page content. Visible only on focus. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      {/* Outer boundary: a render error in the chrome (sidebar, navbar, command
          palette, …) must degrade to an in-app fallback, NOT escape to the root
          global-error "Application Error" page. The inner boundary (around the
          page) catches first for page-level errors, so the chrome survives those. */}
      <ErrorBoundary>
        <Sidebar />
        <CommandPalette />
        <KeyboardShortcutsDialog />
        <LeaderHint />
        <div className="flex flex-col min-h-screen transition-[padding] duration-300 ease-in-out lg:pl-[var(--sidebar-w)]">
          <Navbar />
          {/* pt-14 matches Navbar height (h-14) */}
          <main className="flex-1 pt-14 min-w-0" id="main-content" tabIndex={-1}>
            <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full min-w-0">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    </div>
  );
}
