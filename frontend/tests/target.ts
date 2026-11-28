/**
 * Where the suite runs: the one place that knows the app's and the backend's
 * URLs. `playwright.config.ts`, the global setup and the fixtures (and through
 * them every spec) read them from here, so one variable moves the whole suite.
 *
 * - `OM_TEST_BASE_URL` unset (the default): the Vite dev server on :5173 serves
 *   the app and proxies `/api` to the backend on :3001. Playwright starts both,
 *   or reuses them (see `playwright.config.ts`).
 * - `OM_TEST_BASE_URL=http://127.0.0.1:<port>`: one server that serves the
 *   built app and its API together, as the Go binary does. Playwright starts
 *   nothing and runs against whatever answers there. `pnpm test:prod` uses it
 *   for the binary `make build` produces (`scripts/test-prod.sh`).
 */
const target = (process.env.OM_TEST_BASE_URL ?? '').trim().replace(/\/+$/, '')

/** True when the suite runs against a server it did not start. */
export const EXTERNAL_SERVER = target !== ''

if (EXTERNAL_SERVER && !/^https?:\/\/[^/]+$/.test(target)) {
  throw new Error(`OM_TEST_BASE_URL must be an origin such as http://127.0.0.1:3201, not "${target}"`)
}

/** The URL the pages are opened from (Playwright's `baseURL`). */
export const APP_URL = target || 'http://localhost:5173'

/** The origin the backend answers on: `/api` and the stored files. */
export const BACKEND_URL = target || 'http://127.0.0.1:3001'

/** The backend's REST API, for the data a spec sets up. */
export const API = `${BACKEND_URL}/api`
