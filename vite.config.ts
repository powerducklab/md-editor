import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Core dependencies are always external: the host project manages its own
// versions, keeping the bundle small and avoiding duplicate React/CodeMirror
// instances.
const externalDeps = [
  'markdown-it',
  'katex',
  'markmap-lib',
  'markmap-view',
  'd3',
  '@codemirror/state',
  '@codemirror/view',
  '@codemirror/language',
  '@codemirror/lang-markdown',
  '@codemirror/commands',
  '@codemirror/language-data',
  '@lezer/highlight',
  '@lezer/common',
  '@lezer/markdown',
  'react',
  'react-dom',
  'react/jsx-runtime'
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    setupFiles: ['./test/setup.ts'],
    exclude: ['**/node_modules/**', '**/__MACOSX/**', '**/._*', '**/dist/**'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react/index.ts')
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    rollupOptions: {
      external: externalDeps,
      output: {
        preserveModules: false
      }
    },
    cssCodeSplit: false
  }
});
