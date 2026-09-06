import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['backend/tests/**/*.test.ts'],
    setupFiles: ['backend/tests/setup.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
