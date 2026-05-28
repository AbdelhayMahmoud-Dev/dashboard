import type { AxiosError } from 'axios';

export interface ApiErrorData {
  success: false;
  code?: string;
  message: string;
  errors?: string[];
}

export type AppAxiosError = AxiosError<ApiErrorData>;

/**
 * Categorises every failure mode the client can encounter so callers can act on it.
 * Order of precedence in {@link getErrorMessage} matches this enum top-down.
 */
export type ApiErrorKind =
  | 'server-message'    // server returned a JSON body with `.message`
  | 'rate-limited'      // 429
  | 'unauthorized'      // 401 without server message
  | 'forbidden'         // 403 without server message
  | 'not-found'         // 404 without server message
  | 'validation'        // 422 / 400 without server message
  | 'server-error'      // 5xx without server message
  | 'timeout'           // axios ECONNABORTED / ETIMEDOUT
  | 'canceled'          // axios ERR_CANCELED
  | 'offline'           // ERR_NETWORK / no response — backend unreachable
  | 'unknown';          // none of the above

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Categorises an unknown error. Pure — no side effects. Useful when callers
 * want to branch on the failure mode (e.g. show inline banner vs. toast).
 */
export function classifyError(error: unknown): ApiErrorKind {
  const e = error as AppAxiosError;

  if (e?.response?.data?.message) return 'server-message';

  if (e?.response) {
    const s = e.response.status;
    if (s === 429) return 'rate-limited';
    if (s === 401) return 'unauthorized';
    if (s === 403) return 'forbidden';
    if (s === 404) return 'not-found';
    if (s === 422 || s === 400) return 'validation';
    if (s >= 500)               return 'server-error';
  }

  // No response — diagnose the transport layer.
  const code = e?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return 'timeout';
  if (code === 'ERR_CANCELED')                         return 'canceled';
  if (code === 'ERR_NETWORK' || (e?.request && !e.response)) return 'offline';

  return 'unknown';
}

/**
 * Produces a human-readable, actionable error message.
 *
 *   - Prefers the server-supplied message when present (e.g. "Email already in use").
 *   - Distinguishes transport failures by axios `error.code` so "Cannot reach the
 *     server" becomes a specific diagnosis (offline / timeout / rate-limited).
 *   - In dev, network-failure messages include the configured API base URL so
 *     misconfiguration is debuggable at a glance.
 *
 * Use the matching {@link classifyError} when you need to branch on the kind.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const e = error as AppAxiosError;
  const kind = classifyError(error);

  switch (kind) {
    case 'server-message':
      // The server told us exactly what went wrong — trust it.
      return e.response!.data!.message;

    case 'rate-limited':
      return 'Too many attempts. Please wait a few minutes and try again.';

    case 'unauthorized':
      return 'Your session has expired. Please sign in again.';

    case 'forbidden':
      return "You don't have permission to perform this action.";

    case 'not-found':
      return 'The requested resource could not be found.';

    case 'validation':
      return 'Some of the submitted fields are invalid.';

    case 'server-error': {
      const s = e.response!.status;
      return `The server encountered an error (HTTP ${s}). The team has been notified.`;
    }

    case 'timeout':
      return 'The server took too long to respond. Check your connection and try again.';

    case 'canceled':
      return 'Request canceled.';

    case 'offline':
      // Include the URL we actually tried, so devs see if the env var is wrong.
      return process.env.NODE_ENV === 'production'
        ? 'Unable to reach the server. Check your internet connection and try again.'
        : `Backend appears offline at ${API_BASE}. Start the backend with \`npm run dev:backend\` and retry.`;

    case 'unknown':
    default:
      return fallback;
  }
}

export function getValidationErrors(error: unknown): string[] {
  const axiosError = error as AppAxiosError;
  return axiosError?.response?.data?.errors ?? [];
}

/** True when the error is a 403 Forbidden (permission denied). */
export function isForbiddenError(error: unknown): boolean {
  return (error as AppAxiosError)?.response?.status === 403;
}

/** True when the error is a 401 Unauthorized. */
export function isUnauthorizedError(error: unknown): boolean {
  return (error as AppAxiosError)?.response?.status === 401;
}

/** True when the request failed at the transport layer (backend unreachable). */
export function isOfflineError(error: unknown): boolean {
  return classifyError(error) === 'offline';
}

/** Extract the machine-readable error code if the server sent one. */
export function getErrorCode(error: unknown): string | undefined {
  return (error as AppAxiosError)?.response?.data?.code;
}
