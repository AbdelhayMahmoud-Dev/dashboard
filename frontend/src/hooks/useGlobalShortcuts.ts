'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Global keyboard shortcuts for the dashboard.
 *
 * Implemented here (cmd/ctrl+K is owned by CommandPalette):
 *   ?           → open the keyboard shortcuts help overlay
 *   g d/p/o/c/s → navigate (Linear-style leader chord)
 *   g u         → navigate to /users (admin/super_admin only)
 *
 * Suppressed when:
 *   - a typing target is focused (input/textarea/contenteditable)
 *   - the command palette or shortcuts help dialog is open
 *   - any modifier key is held with the trigger key
 */

const LEADER_TIMEOUT_MS = 1500;

const G_CHORDS = {
  d: '/dashboard',
  p: '/products',
  o: '/orders',
  c: '/customers',
  s: '/settings',
  u: '/users',
} as const;

type ChordKey = keyof typeof G_CHORDS;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function hasModifier(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey || e.altKey;
}

export function useGlobalShortcuts() {
  const router = useRouter();

  /**
   * Refs avoid re-binding the listener on every state change. The handler
   * reads the latest values directly via getState() / refs.
   */
  const leaderTimerRef = useRef<number | null>(null);
  const leaderActiveRef = useRef(false);

  useEffect(() => {
    const setLeader = useUIStore.getState().setLeaderActive;

    const clearLeader = () => {
      if (leaderTimerRef.current !== null) {
        window.clearTimeout(leaderTimerRef.current);
        leaderTimerRef.current = null;
      }
      if (leaderActiveRef.current) {
        leaderActiveRef.current = false;
        setLeader(false);
      }
    };

    const startLeader = () => {
      clearLeader();
      leaderActiveRef.current = true;
      setLeader(true);
      leaderTimerRef.current = window.setTimeout(clearLeader, LEADER_TIMEOUT_MS);
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const { commandOpen, shortcutsHelpOpen } = useUIStore.getState();

      // Escape always clears any pending chord.
      if (e.key === 'Escape') {
        clearLeader();
        return;
      }

      // No global shortcuts fire while a top-level dialog is open.
      if (commandOpen || shortcutsHelpOpen) return;

      // "?" — open shortcuts help. Shift is required to produce "?" on most layouts,
      // so we don't reject Shift here; we only reject the heavier modifiers.
      if (e.key === '?' && !hasModifier(e)) {
        e.preventDefault();
        useUIStore.getState().setShortcutsHelpOpen(true);
        return;
      }

      // Resolve a pending G-chord.
      if (leaderActiveRef.current) {
        clearLeader();
        const k = e.key.toLowerCase() as ChordKey;
        const dest = G_CHORDS[k];
        if (!dest) return;
        if (k === 'u') {
          const role = useAuthStore.getState().user?.role;
          if (role !== 'admin' && role !== 'super_admin') return;
        }
        e.preventDefault();
        router.push(dest);
        return;
      }

      // Begin a G-chord. Plain "g" only — Shift, modifiers, or non-letter keys ignored.
      if (e.key === 'g' && !hasModifier(e) && !e.shiftKey) {
        e.preventDefault();
        startLeader();
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearLeader();
    };
  }, [router]);
}
