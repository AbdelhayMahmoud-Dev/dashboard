/**
 * Centralized environment-variable validation.
 *
 * Runs once at module load. Any missing required variable, weak secret,
 * or malformed value crashes the process at startup with a clear,
 * single-line error — never at request time, never silently.
 *
 * Adds:
 *   - typed `env` export (no more `process.env.X!` non-null assertions)
 *   - explicit weak-secret detection in production
 *   - sensible defaults for optional vars
 */
import 'dotenv/config';

interface RequiredString {
  kind:        'required-string';
  name:        string;
  minLength?:  number;
  /** When true, values matching weak-default patterns are rejected in production. */
  rejectWeak?: boolean;
}
interface OptionalString {
  kind:     'optional-string';
  name:     string;
  fallback: string;
}
interface RequiredInt {
  kind:     'required-int';
  name:     string;
  min?:     number;
  max?:     number;
  fallback?: number;
}
type Rule = RequiredString | OptionalString | RequiredInt;

// ── Rule set ──────────────────────────────────────────────────────────────────
const RULES: Rule[] = [
  { kind: 'required-string', name: 'MONGODB_URI' },
  { kind: 'required-string', name: 'JWT_SECRET',         minLength: 32, rejectWeak: true },
  { kind: 'required-string', name: 'JWT_REFRESH_SECRET', minLength: 32, rejectWeak: true },
  { kind: 'optional-string', name: 'JWT_EXPIRE',         fallback: '15m' },
  { kind: 'optional-string', name: 'JWT_REFRESH_EXPIRE', fallback: '7d'  },
  { kind: 'optional-string', name: 'CLIENT_URL',         fallback: 'http://localhost:3000' },
  { kind: 'optional-string', name: 'NODE_ENV',           fallback: 'development' },
  { kind: 'required-int',    name: 'PORT',               min: 1, max: 65535, fallback: 5000 },
  { kind: 'optional-string', name: 'COOKIE_SECRET',      fallback: 'dev_cookie_secret_dev_only' },
  { kind: 'optional-string', name: 'REDIS_URL',          fallback: '' },
  { kind: 'optional-string', name: 'CLOUDINARY_CLOUD_NAME', fallback: '' },
  { kind: 'optional-string', name: 'CLOUDINARY_API_KEY',    fallback: '' },
  { kind: 'optional-string', name: 'CLOUDINARY_API_SECRET', fallback: '' },
];

// Patterns that look like template defaults — refuse to start prod with these.
const WEAK_PATTERNS = [
  /change[_ -]?me/i,
  /your[_ -]?secret/i,
  /^dev[_ -]/i,
  /^test[_ -]/i,
  /^secret$/i,
  /^password$/i,
];

function isWeakSecret(value: string): boolean {
  return WEAK_PATTERNS.some((re) => re.test(value));
}

// ── Validate ──────────────────────────────────────────────────────────────────
const errors: string[] = [];
const validated: Record<string, string | number> = {};
const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

for (const rule of RULES) {
  const raw = process.env[rule.name];

  if (rule.kind === 'required-string') {
    if (!raw || raw.trim() === '') {
      errors.push(`Missing required env var: ${rule.name}`);
      continue;
    }
    if (rule.minLength && raw.length < rule.minLength) {
      errors.push(`${rule.name} must be at least ${rule.minLength} characters (got ${raw.length})`);
      continue;
    }
    if (isProd && rule.rejectWeak && isWeakSecret(raw)) {
      errors.push(`${rule.name} looks like a placeholder/default value — change it before deploying to production`);
      continue;
    }
    validated[rule.name] = raw;
    continue;
  }

  if (rule.kind === 'optional-string') {
    validated[rule.name] = raw && raw.trim() !== '' ? raw : rule.fallback;
    continue;
  }

  if (rule.kind === 'required-int') {
    const fallback = rule.fallback;
    if (!raw || raw.trim() === '') {
      if (fallback === undefined) {
        errors.push(`Missing required env var: ${rule.name}`);
        continue;
      }
      validated[rule.name] = fallback;
      continue;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      errors.push(`${rule.name} must be an integer (got "${raw}")`);
      continue;
    }
    if (rule.min !== undefined && n < rule.min) {
      errors.push(`${rule.name} must be >= ${rule.min} (got ${n})`);
      continue;
    }
    if (rule.max !== undefined && n > rule.max) {
      errors.push(`${rule.name} must be <= ${rule.max} (got ${n})`);
      continue;
    }
    validated[rule.name] = n;
  }
}

if (errors.length > 0) {
  console.error('\n❌ Invalid environment configuration:\n');
  for (const e of errors) console.error(`   • ${e}`);
  console.error('\nFix the values in backend/.env (see .env.example for the required shape) and restart.\n');
  process.exit(1);
}

// ── Typed export ──────────────────────────────────────────────────────────────
export const env = {
  NODE_ENV:               validated.NODE_ENV               as string,
  PORT:                   validated.PORT                   as number,
  MONGODB_URI:            validated.MONGODB_URI            as string,
  JWT_SECRET:             validated.JWT_SECRET             as string,
  JWT_REFRESH_SECRET:     validated.JWT_REFRESH_SECRET     as string,
  JWT_EXPIRE:             validated.JWT_EXPIRE             as string,
  JWT_REFRESH_EXPIRE:     validated.JWT_REFRESH_EXPIRE     as string,
  CLIENT_URL:             validated.CLIENT_URL             as string,
  COOKIE_SECRET:          validated.COOKIE_SECRET          as string,
  REDIS_URL:              validated.REDIS_URL              as string,
  CLOUDINARY_CLOUD_NAME:  validated.CLOUDINARY_CLOUD_NAME  as string,
  CLOUDINARY_API_KEY:     validated.CLOUDINARY_API_KEY     as string,
  CLOUDINARY_API_SECRET:  validated.CLOUDINARY_API_SECRET  as string,
  isProd:                 (validated.NODE_ENV as string) === 'production',
  isDev:                  (validated.NODE_ENV as string) === 'development',
} as const;

export type Env = typeof env;
