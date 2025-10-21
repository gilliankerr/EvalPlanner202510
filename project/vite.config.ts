import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('@uiw/react-md-editor') ||
              id.includes('react-markdown') ||
              id.includes('rehype') ||
              id.includes('remark') ||
              id.includes('marked')
            ) {
              return 'md-editor';
            }

            if (id.includes('lucide-react')) {
              return 'icons';
            }

            if (
              id.includes('react-dom') ||
              id.includes('react-router-dom') ||
              id.includes('scheduler') ||
              id.includes('use-sync-external-store')
            ) {
              return 'react-vendor';
            }

            if (id.includes('highlight.js') || id.includes('dompurify')) {
              return 'rendering-utils';
            }
          }
        },
      },
    },
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
        timeout: 180000, // 3 minute timeout (async jobs handle long AI responses)
        proxyTimeout: 180000
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
