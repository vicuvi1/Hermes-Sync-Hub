import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hermes-hub/types': path.resolve(__dirname, '../../packages/types/src'),
      '@hermes-hub/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@hermes-hub/protocol': path.resolve(__dirname, '../../packages/protocol/src'),
      '@hermes-hub/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
