/**
 * Test bootstrap. src/config/env.ts validates required env vars at import time
 * and calls process.exit(1) if any are missing — so we must populate safe test
 * values BEFORE any module that imports `env` is loaded. Vitest runs setupFiles
 * ahead of the test files' imports, so assigning here is sufficient.
 *
 * dotenv (loaded by env.ts) does not override already-set process.env values,
 * so these win even if a real .env is present.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/saas-dashboard-test';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_chars_long_xxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_chars_long_yyyy';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
