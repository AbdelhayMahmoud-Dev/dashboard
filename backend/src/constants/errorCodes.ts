/**
 * Centralized error code registry.
 * Every ApiError thrown in the system MUST use one of these codes so the
 * frontend can react to specific errors without parsing message strings.
 *
 * Format: DOMAIN_ISSUE  →  numeric status + machine-readable code string
 */

export const ERROR_CODES = {
  // ── Auth ────────────────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS:  { status: 401, code: 'AUTH_INVALID_CREDENTIALS' },
  AUTH_TOKEN_MISSING:        { status: 401, code: 'AUTH_TOKEN_MISSING' },
  AUTH_TOKEN_INVALID:        { status: 401, code: 'AUTH_TOKEN_INVALID' },
  AUTH_TOKEN_EXPIRED:        { status: 401, code: 'AUTH_TOKEN_EXPIRED' },
  AUTH_REFRESH_INVALID:      { status: 401, code: 'AUTH_REFRESH_INVALID' },
  AUTH_REFRESH_REUSE:        { status: 401, code: 'AUTH_REFRESH_REUSE' },
  AUTH_ACCOUNT_INACTIVE:     { status: 403, code: 'AUTH_ACCOUNT_INACTIVE' },
  AUTH_INSUFFICIENT_PERMS:   { status: 403, code: 'AUTH_INSUFFICIENT_PERMS' },

  // ── Resource ────────────────────────────────────────────────────────────
  RESOURCE_NOT_FOUND:        { status: 404, code: 'RESOURCE_NOT_FOUND' },
  RESOURCE_CONFLICT:         { status: 409, code: 'RESOURCE_CONFLICT' },

  // ── Validation ──────────────────────────────────────────────────────────
  VALIDATION_FAILED:         { status: 422, code: 'VALIDATION_FAILED' },
  VALIDATION_INVALID_ID:     { status: 400, code: 'VALIDATION_INVALID_ID' },

  // ── Upload ──────────────────────────────────────────────────────────────
  UPLOAD_NO_FILES:           { status: 400, code: 'UPLOAD_NO_FILES' },
  UPLOAD_TOO_LARGE:          { status: 413, code: 'UPLOAD_TOO_LARGE' },
  UPLOAD_INVALID_TYPE:       { status: 415, code: 'UPLOAD_INVALID_TYPE' },
  UPLOAD_CLOUDINARY_FAILED:  { status: 502, code: 'UPLOAD_CLOUDINARY_FAILED' },

  // ── Rate limit ──────────────────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED:       { status: 429, code: 'RATE_LIMIT_EXCEEDED' },

  // ── Server ──────────────────────────────────────────────────────────────
  INTERNAL_ERROR:            { status: 500, code: 'INTERNAL_ERROR' },
  DB_ERROR:                  { status: 503, code: 'DB_ERROR' },
  CACHE_ERROR:               { status: 503, code: 'CACHE_ERROR' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Build a structured ApiError payload from an error code */
export function errorPayload(code: ErrorCode, messageOverride?: string) {
  const entry = ERROR_CODES[code];
  return {
    status: entry.status,
    code: entry.code,
    message: messageOverride ?? entry.code.replace(/_/g, ' ').toLowerCase(),
  };
}
