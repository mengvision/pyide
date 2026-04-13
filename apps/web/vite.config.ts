import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@pyide/platform': path.resolve(__dirname, '../../packages/platform/src/index.ts'),
        '@desktop': path.resolve(__dirname, '../desktop/src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/ws': {
          target: apiUrl.replace(/^http/, 'ws'),
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React runtime
            'vendor-react': ['react', 'react-dom'],
            // Monaco editor (large)
            'vendor-monaco': ['@monaco-editor/react'],
            // Plotly charting (large)
            'vendor-plotly': ['plotly.js', 'react-plotly.js'],
            // AG Grid data tables
            'vendor-aggrid': ['ag-grid-community', 'ag-grid-react'],
            // Markdown rendering
            'vendor-markdown': ['react-markdown', 'remark-gfm', 'react-syntax-highlighter'],
            // State management
            'vendor-state': ['zustand'],
            // Utilities
            'vendor-utils': ['uuid', 'js-yaml'],
          },
        },
      },
    },
  };
});
