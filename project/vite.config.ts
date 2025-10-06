import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    fs: {
      allow: ['..']
    },
    // Proxy API requests to backend in development mode only
    // In production, backend serves the frontend from the same port
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 600000, // 10 minute timeout for long AI responses
        proxyTimeout: 600000
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
  },
});
