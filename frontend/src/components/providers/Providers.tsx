'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { makeQueryClient } from '@/lib/queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  /**
   * WHY useState with a factory:
   *   `useState(() => makeQueryClient())` runs the factory exactly once per
   *   component mount. This gives every browser session its own QueryClient
   *   instance — preventing SSR request-to-request data leakage — while still
   *   being stable across re-renders (useState never re-runs the initialiser).
   */
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster
          position="top-right"
          richColors
          expand
          toastOptions={{
            duration: 4000,
            classNames: {
              toast: 'font-sans text-sm',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
