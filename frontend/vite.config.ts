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
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/yjs') || id.includes('node_modules/y-websocket') || id.includes('node_modules/y-codemirror')) {
            return 'yjs-vendor'
          }
          if (id.includes('node_modules/@codemirror/lang-')) {
            return 'codemirror-langs'
          }
          if (id.includes('node_modules/@codemirror/')) {
            return 'codemirror-core'
          }
        },
      },
    },
  },
})
