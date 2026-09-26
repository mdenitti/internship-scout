import path from 'node:path';

import { defineConfig } from 'vitest/config';

/** Vitest configuration: mirrors the app's `@/*` path alias and runs tests in Node. */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
});
