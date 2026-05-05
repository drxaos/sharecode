import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'codemirror-core': [
            '@codemirror/view',
            '@codemirror/state',
            '@codemirror/language',
            '@codemirror/commands',
            '@codemirror/theme-one-dark',
          ],
          'codemirror-langs': [
            '@codemirror/lang-javascript',
            '@codemirror/lang-python',
            '@codemirror/lang-go',
            '@codemirror/lang-java',
            '@codemirror/lang-cpp',
            '@codemirror/lang-rust',
            '@codemirror/lang-html',
            '@codemirror/lang-css',
            '@codemirror/lang-json',
            '@codemirror/lang-sql',
            '@codemirror/lang-yaml',
            '@codemirror/lang-markdown',
            '@codemirror/lang-xml',
            '@codemirror/lang-php',
          ],
          'yjs-vendor': ['yjs', 'y-websocket', 'y-codemirror.next'],
        },
      },
    },
  },
})
