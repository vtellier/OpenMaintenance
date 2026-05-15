import path from 'node:path'
import { defineConfig } from 'vite'

const arrowPackages = ['@arrow-js/core', '@arrow-js/framework']

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@generated': path.resolve(__dirname, 'generated'),
    },
  },
  optimizeDeps: {
    exclude: arrowPackages,
  },
  build: {
    outDir: 'dist/client',
  },
})
