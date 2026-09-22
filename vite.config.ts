import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to Fastify; `npm start` serves the build from Fastify instead.
const API_PORT = process.env.PORT ?? '3000';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${API_PORT}`,
    },
  },
});
