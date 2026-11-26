import { test as base, expect, type BrowserContext, type Page, type Route } from '@playwright/test'
import { API, APP_URL, BACKEND_URL } from './target'

/**
 * Every spec imports `test` and `expect` from here, not from
 * `@playwright/test`.
 *
 * The `context` fixture below collects every uncaught page error (the
 * `pageerror` of any page in the test's browser context) and every console
 * message of type `error`. At teardown the test fails and lists them, so a
 * console error or an uncaught exception fails the suite even when the screen
 * looks right (#148).
 *
 * A test that provokes an error on purpose declares it first:
 *
 *   test('a refused upload shows the reason', async ({ page, expectErrors }) => {
 *     expectErrors(failedRequest(`/api/equipments/${id}/files`, 413))
 *     ...
 *   })
 *
 * Every declared error must be logged at least once, and any other error
 * still fails the test. Keep each declaration narrow, so it cannot swallow an
 * unrelated error. One declaration accepts every error it matches, so a
 * request that fails three times needs it only once.
 *
 * The same fixture keeps the suite off the internet: see `stayOffline`.
 */

/**
 * One error a test expects:
 * - a string matches the message exactly;
 * - a RegExp matches part of it, so anchor it and keep it tight;
 * - `{ message, path }` also requires the URL the error is reported at to have
 *   that pathname: a string matches it exactly, a RegExp matches part of it.
 *   For a failed request that URL is the request's; for a page error it is the
 *   page's.
 */
export type ErrorMatcher =
  | string
  | RegExp
  | { message: string | RegExp; path: string | RegExp }

/** An `ErrorMatcher` in its one internal shape. */
type Declared = { message: string | RegExp; path?: string | RegExp; label: string }

/**
 * The console error Chromium logs when a request the page made fails:
 * - a number is the HTTP status the server answered, e.g. `400` for "Failed
 *   to load resource: the server responded with a status of 400 (Bad
 *   Request)";
 * - a string is a network error, e.g. `'net::ERR_FAILED'` for a request
 *   `route.abort()` cut off.
 */
export function failedRequest(path: string | RegExp, status: number | `net::${string}`): ErrorMatcher {
  const message = typeof status === 'number'
    ? new RegExp(`^Failed to load resource: the server responded with a status of ${status} \\(`)
    : `Failed to load resource: ${status}`
  return { message, path }
}

type LoggedError = { kind: 'pageerror' | 'console.error'; text: string; url: string; where: string }

type Fixtures = {
  /** Declares the errors this test provokes on purpose. */
  expectErrors: (...matchers: ErrorMatcher[]) => void
  _expectedErrors: Declared[]
}

function declare(matcher: ErrorMatcher): Declared {
  if (typeof matcher === 'string' || matcher instanceof RegExp) {
    return { message: matcher, label: String(matcher) }
  }
  return { ...matcher, label: `${String(matcher.message)} at ${String(matcher.path)}` }
}

function matchesText(pattern: string | RegExp, text: string): boolean {
  return typeof pattern === 'string' ? text === pattern : pattern.test(text)
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

function matches(declared: Declared, error: LoggedError): boolean {
  return matchesText(declared.message, error.text)
    && (declared.path === undefined || matchesText(declared.path, pathOf(error.url)))
}

function formatErrors(errors: LoggedError[]): string {
  return errors.map(e => `  - ${e.kind}: ${e.text}${e.where ? ` (${e.where})` : ''}`).join('\n')
}

/**
 * The hosts the app is served from: the dev server, the backend, a preview,
 * or the server `OM_TEST_BASE_URL` names (`tests/target.ts`).
 */
const APP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', new URL(APP_URL).hostname])

/**
 * Keeps every test off the internet, so a slow or unreachable third party
 * cannot fail it. `index.html` loads its fonts from Google Fonts; a failed
 * font request is a console error, and so it would fail a test that has
 * nothing to do with fonts.
 * - The Google Fonts stylesheet is answered with an empty stylesheet, so no
 *   font file is ever requested. The pages fall back to the system fonts.
 * - Any other request off the app's hosts is blocked. Its console error
 *   (`net::ERR_BLOCKED_BY_CLIENT`) then fails the test every time, rather than
 *   only when the network is down.
 * Requests to the app itself are never touched: their failures stay visible.
 */
async function stayOffline(context: BrowserContext): Promise<void> {
  const offApp = (url: URL) => /^https?:$/.test(url.protocol) && !APP_HOSTS.has(url.hostname)
  await context.route(offApp, (route: Route) => {
    if (new URL(route.request().url()).hostname === 'fonts.googleapis.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    }
    return route.abort('blockedbyclient')
  })
}

/**
 * Waits for one animation frame and one task on every open page, so an error
 * logged just after the test's last step is collected before the check. A
 * longer timer can still be missed: end a spec on an assertion.
 */
async function settle(context: BrowserContext): Promise<void> {
  for (const page of context.pages()) {
    if (page.isClosed()) continue
    await page
      .evaluate(() => new Promise<void>(resolve => {
        // A page that renders no frames (hidden, throttled) still resolves.
        const fallback = setTimeout(resolve, 200)
        requestAnimationFrame(() => setTimeout(() => {
          clearTimeout(fallback)
          resolve()
        }))
      }))
      .catch(() => {})
  }
}

export const test = base.extend<Fixtures>({
  _expectedErrors: async ({}, use) => {
    await use([])
  },

  expectErrors: async ({ _expectedErrors }, use) => {
    await use((...matchers) => {
      _expectedErrors.push(...matchers.map(declare))
    })
  },

  context: async ({ context, _expectedErrors }, use) => {
    const logged: LoggedError[] = []
    context.on('weberror', webError => {
      const err = webError.error()
      const pageUrl = webError.page()?.url() ?? ''
      logged.push({ kind: 'pageerror', text: err.message, url: pageUrl, where: pageUrl })
    })
    context.on('console', msg => {
      if (msg.type() !== 'error') return
      const { url, lineNumber } = msg.location()
      logged.push({ kind: 'console.error', text: msg.text(), url, where: url ? `${url}:${lineNumber}` : '' })
    })
    await stayOffline(context)

    await use(context)

    await settle(context)

    // A declared error the test provoked may still be on its way from the
    // browser when the test body ends: wait for it rather than fail early.
    const missing = () => _expectedErrors.filter(d => !logged.some(e => matches(d, e))).map(d => d.label)
    await expect.poll(() => missing().length, { timeout: 2_000 }).toBe(0).catch(() => {})

    // Report both problems together: an undeclared error is often the reason
    // a declared one never came.
    const problems: string[] = []
    const neverLogged = missing()
    if (neverLogged.length > 0) {
      problems.push(`Expected errors were never logged:\n${neverLogged.map(l => `  - ${l}`).join('\n')}`)
    }
    const unexpected = logged.filter(e => !_expectedErrors.some(d => matches(d, e)))
    if (unexpected.length > 0) {
      problems.push(`The page logged ${unexpected.length} unexpected error(s):\n${formatErrors(unexpected)}`)
    }
    if (problems.length > 0) throw new Error(problems.join('\n\n'))
  },
})

export { expect }
export type { Page } from '@playwright/test'

/**
 * The backend's REST API (`API`) and origin (`BACKEND_URL`, for a stored
 * file's `url`), for the data a spec sets up and checks. Never write a host or
 * a port in a spec: these follow `OM_TEST_BASE_URL` (`tests/target.ts`).
 */
export { API, BACKEND_URL }

/**
 * POSTs `data` to the API path (e.g. `/equipments`) and returns the JSON
 * answer. A refused setup fails the test here, with the backend's reason,
 * rather than later with a confusing error.
 */
export async function apiPost(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}${path}`, { data })
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}
