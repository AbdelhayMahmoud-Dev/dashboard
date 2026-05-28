/**
 * WHY force-dynamic:
 *   Next.js 16 has a bug where both /_not-found and /_global-error try to
 *   access `workStore` (the per-request async context) during static
 *   generation — before the context exists — and throw:
 *     "InvariantError: Expected workStore to be initialized."
 *   Marking this segment `force-dynamic` skips the static-generation pass
 *   for /_not-found, eliminating the invariant and allowing `next build` to
 *   succeed. The /_not-found route is only hit for 404 responses, so there
 *   is no meaningful SEO cost to skipping static prerendering here.
 */
export const dynamic = 'force-dynamic';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold text-muted-foreground select-none">4</span>
          <span className="text-4xl font-bold text-primary select-none">0</span>
          <span className="text-4xl font-bold text-muted-foreground select-none">4</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
