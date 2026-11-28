/// <reference types="vitest/config" />
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Timezones the unit tests run under: UTC, two east of it (UTC+1/+2 and
// UTC+14) and two west (UTC−5/−4 and UTC−11).
const TEST_TIMEZONES = ['UTC', 'Europe/Paris', 'Pacific/Kiritimati', 'America/New_York', 'Pacific/Pago_Pago']

// The latest v* release tag, as the Makefile's VERSION names the binary (#197).
function getVersion(): string {
  try {
    return execFileSync('git', ['describe', '--tags', '--match', 'v*', '--always', '--dirty'], { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react()],
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
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  // Vitest unit tests (`pnpm test:unit`) sit next to the code they cover:
  // src/ for the app, the frontend root for the build (build-version.test.ts).
  // Playwright specs live in tests/ and must stay out of Vitest's reach.
  test: {
    include: ['src/**/*.test.{ts,tsx}', '*.test.ts'],
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
