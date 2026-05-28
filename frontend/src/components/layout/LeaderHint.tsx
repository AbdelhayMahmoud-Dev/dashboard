'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';

/**
 * Bottom-right HUD chip shown for ~1.5s after the user presses G,
 * indicating the dashboard is waiting for the next chord key.
 * Mirrors the Linear/Notion leader-key affordance.
 */
export function LeaderHint() {
  const leaderActive = useUIStore((s) => s.leaderActive);

  return (
    <AnimatePresence>
      {leaderActive && (
        <motion.div
          key="leader-hint"
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-[60] pointer-events-none select-none"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-lg border border-border bg-popover/95 px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg supports-backdrop-filter:backdrop-blur-md">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none">
              G
            </kbd>
            <span className="text-muted-foreground">then</span>
            <span className="text-muted-foreground">D / P / O / C / S</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
