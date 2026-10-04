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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
