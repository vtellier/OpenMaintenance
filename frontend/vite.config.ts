import path from 'node:path'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

const arrowPackages = ['@arrow-js/core', '@arrow-js/framework']

function getVersion(): string {
  try {
    return execSync('git describe --tags --always --dirty', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

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
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  build: {
    outDir: 'dist/client',
  },
})
