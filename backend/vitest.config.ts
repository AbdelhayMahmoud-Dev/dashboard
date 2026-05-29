import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // setup.ts populates the env vars that src/config/env.ts validates at import
    // time — it must run before any module that transitively imports `env`.
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
});
