import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import fs from 'fs';

// Rewrites .js imports → .ts when the .ts file exists (for workspace packages
// that use NodeNext .js extensions in their TypeScript source).
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
});
