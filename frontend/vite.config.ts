import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envDir: '..',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': ['@tanstack/react-query'],
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'ui-vendor': ['@radix-ui/react-dropdown-menu', 'lucide-react'],
        },
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/tests/setup.ts', css: true },
});
