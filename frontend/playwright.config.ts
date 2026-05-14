import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for OpenMaintenance non-regression tests.
 *
 * Assumes the backend (:3001) and frontend (:5173) are already running.
 * Run `npm run dev` in `frontend/` and `go run .` in `backend/` first.
 *
 * The global setup wipes the DB via the API before the test run.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
