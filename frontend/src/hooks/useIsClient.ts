'use client';

import { useSyncExternalStore } from 'react';

/**
 * Returns `false` during server render and the first client render,
 * then `true` after hydration completes. Use this to gate any text or
 * value derived from `Date()`, `Math.random()`, locale, timezone, or
 * other client-only sources that would otherwise cause hydration
 * mismatches.
 *
 * Implemented with `useSyncExternalStore` and stable snapshot fns so
 * React's `react-hooks/set-state-in-effect` rule is satisfied — unlike
 * the common `useState(false) + useEffect(() => setMounted(true), [])`
 * pattern.
 */
const subscribe = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
