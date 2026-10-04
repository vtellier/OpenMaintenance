/// <reference types="vitest/config" />
import path from 'node:path'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

const arrowPackages = ['@arrow-js/core', '@arrow-js/framework']

// Timezones the unit tests run under: UTC, two east of it (UTC+1/+2 and
// UTC+14) and two west (UTC−5/−4 and UTC−11).
const TEST_TIMEZONES = ['UTC', 'Europe/Paris', 'Pacific/Kiritimati', 'America/New_York', 'Pacific/Pago_Pago']

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
    proxy: {
      '/api': 'http://localhost:3001',
    },
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
  // Vitest unit tests (`pnpm test:unit`) sit next to the code they cover.
  // Playwright specs live in tests/ and must stay out of Vitest's reach.
  test: {
    include: ['src/**/*.test.ts'],
    // Every unit test runs once in the machine's timezone ('local') and once
    // per timezone below, east and west of UTC, so date code cannot depend on
    // where it runs. TZ only takes effect for a whole process, hence the
    // 'forks' pool: worker threads would all share the parent's timezone.
    pool: 'forks',
    projects: [
      { extends: true, test: { name: 'local' } },
      ...TEST_TIMEZONES.map(tz => ({ extends: true, test: { name: tz, env: { TZ: tz } } })),
    ],
  },
})
