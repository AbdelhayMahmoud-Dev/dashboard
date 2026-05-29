import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Minimal monitoring abstraction.
 *
 * Error reporting is OPTIONAL and fully decoupled from the rest of the app:
 *   - If `SENTRY_DSN` is unset, this is a no-op and the app relies on the
 *     structured Winston logs alone.
 *   - If `SENTRY_DSN` is set AND `@sentry/node` is installed, exceptions are
 *     forwarded to Sentry with request context.
 *
 * The `@sentry/node` import is deliberately dynamic and the specifier is cast to
 * `string` so the TypeScript build does NOT require the package to be present.
 * This keeps Sentry a true opt-in dependency: `npm i @sentry/node` + set the DSN
 * and it lights up; do nothing and the build/runtime are unaffected.
 */
type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, hint?: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;

export async function initMonitoring(): Promise<void> {
  if (!env.SENTRY_DSN) {
    logger.info('Monitoring: SENTRY_DSN not set — error reporting via logs only.');
    return;
  }
  try {
    const mod = (await import('@sentry/node' as string)) as SentryLike;
    mod.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    sentry = mod;
    logger.info('Monitoring: Sentry initialised.');
  } catch {
    logger.warn(
      'Monitoring: SENTRY_DSN is set but @sentry/node is not installed — run `npm i @sentry/node` to enable error reporting.'
    );
  }
}

/** Forward an exception to the monitoring backend, if one is configured. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  sentry.captureException(err, context ? { extra: context } : undefined);
}
