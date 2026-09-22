import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Plain-module tests only (server persistence/config, shared/web logic). No jsdom, no fake timers.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['{server,web,shared}/**/*.test.ts'],
  },
});
