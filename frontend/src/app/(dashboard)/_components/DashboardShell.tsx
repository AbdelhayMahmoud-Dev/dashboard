'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { KeyboardShortcutsDialog } from '@/components/layout/KeyboardShortcutsDialog';
import { LeaderHint } from '@/components/layout/LeaderHint';
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';
import { useUIStore } from '@/store/uiStore';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { motion } from 'framer-motion';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  useGlobalShortcuts();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <CommandPalette />
      <KeyboardShortcutsDialog />
      <LeaderHint />
      <motion.div
        className="flex flex-col min-h-screen"
        animate={{ paddingLeft: sidebarCollapsed ? 68 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <Navbar />
        {/* pt-14 matches Navbar height (h-14) */}
        <main className="flex-1 pt-14" id="main-content" tabIndex={-1}>
          <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </motion.div>
    </div>
  );
}
