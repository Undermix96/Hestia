import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The backend listens on :8000 during local development (`uv run ...` in backend/).
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    // The message catalogs live in ../locales (repository root): let the dev server read them.
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../locales', import.meta.url)),
      ],
    },
    proxy: {
      '/api': { target: backendUrl, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    // Hashed files under /assets/ get a long cache in nginx (see nginx/default.conf.template).
    assetsDir: 'assets',
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
});
