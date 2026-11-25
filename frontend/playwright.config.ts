import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for OpenMaintenance non-regression tests.
 *
 * Servers: the `webServer` entries below start the backend (:3001) and the
 * Vite dev server (:5173) when they are not already up — that is how CI runs
 * the suite. `reuseExistingServer: true` means an already-running pair
 * (`make dev`, or `go run .` in `backend/` plus `pnpm dev` in `frontend/`) is
 * used as-is, so the local workflow is unchanged.
 *
 * The global setup then wipes the DB via the API before the test run.
 *
 * `fullyParallel: false` and `workers: 1` are load-bearing: every spec shares
 * one backend and one database that is wiped once per run. Do not parallelise.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  // A stray `test.only` must fail CI instead of silently running one test.
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Backend. `/api/version` is the readiness probe — there is no
      // `/api/health` endpoint. `cwd` is resolved against this config file.
      command: 'go run .',
      cwd: '../backend',
      url: 'http://127.0.0.1:3001/api/version',
      reuseExistingServer: true,
      // Generous: a cold CI runner has to compile the backend first.
      timeout: 180_000,
    },
    {
      // Vite dev server; it binds 127.0.0.1 explicitly (see vite.config.ts).
      command: 'pnpm dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  // Both projects share the one backend and database, one after the other.
  // Specs that run in both (smoke, navigation) must not rely on a name being
  // unique across the run.
  projects: [
    {
      // Desktop: every spec except the phone-only ones.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /\/mobile-[^/]*\.spec\.ts$/,
    },
    {
      // A phone: the bottom tab bar replaces the top navbar (doc/gui/navigation.md).
      // Only a subset runs here, to keep CI time reasonable: the smoke and
      // navigation specs, and the `mobile-*.spec.ts` specs. Pixel 7 runs on
      // Chromium, the one browser CI installs.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: [/\/smoke\.spec\.ts$/, /\/navigation\.spec\.ts$/, /\/mobile-[^/]*\.spec\.ts$/],
    },
  ],
})
