import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import fs from 'fs';

function resolveWorkspaceExtensions() {
  return {
    name: 'resolve-workspace-ts-extensions',
    resolveId(id: string, importer: string | undefined) {
      if (!importer) return null;
      if (!id.endsWith('.js')) return null;
      const tsPath = id.startsWith('.')
        ? resolve(importer, '..', id.replace(/\.js$/, '.ts'))
        : null;
      if (tsPath && fs.existsSync(tsPath)) return tsPath;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveWorkspaceExtensions(), react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime — cached long-term, never changes
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // Router
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          // Form + validation
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/zod')) {
            return 'vendor-forms';
          }
          // Icons (large — split from app code so it caches separately)
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Everything else in node_modules
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
});
