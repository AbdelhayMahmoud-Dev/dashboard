'use client';

// NOTE: export const dynamic is intentionally omitted — Next.js 16.2.6 strips
// appConfig for /_global-error so force-dynamic has no effect here. Static
// prerendering of this route is prevented by scripts/patch-next-build.js which
// fixes the underlying workStore invariant bug in next/dist/build/utils.js.

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '480px' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111', margin: '0 0 0.5rem' }}>
            Application Error
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
            An unexpected error occurred. This has been logged and we&apos;re looking into it.
          </p>
          <button
            onClick={unstable_retry}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.6rem 1.5rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
