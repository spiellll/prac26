import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The existing React screens are built unchanged. Flask serves the result.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  build: { outDir: 'frontend-dist', emptyOutDir: true },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:5001', changeOrigin: false } },
  },
});
