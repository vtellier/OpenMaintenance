import { test as base, expect } from '@playwright/test'

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
 * unrelated error.
 */

/**
 * One error a test expects:
 * - a string matches the message exactly;
 * - a RegExp matches part of it, so anchor it and keep it tight;
 * - `{ message, path }` also requires the URL the error is reported at (for a
 *   failed request, the request URL) to have that pathname: a string matches
 *   it exactly, a RegExp matches part of it.
 */
export type ErrorMatcher =
  | string
  | RegExp
  | { message: string | RegExp; path: string | RegExp }

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
  _expectedErrors: ErrorMatcher[]
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

function matches(matcher: ErrorMatcher, error: LoggedError): boolean {
  if (typeof matcher === 'string' || matcher instanceof RegExp) return matchesText(matcher, error.text)
  return matchesText(matcher.message, error.text) && matchesText(matcher.path, pathOf(error.url))
}

function show(matcher: ErrorMatcher): string {
  if (typeof matcher === 'string' || matcher instanceof RegExp) return String(matcher)
  return `${String(matcher.message)} at ${String(matcher.path)}`
}

function formatErrors(errors: LoggedError[]): string {
  return errors.map(e => `  - ${e.kind}: ${e.text}${e.where ? ` (${e.where})` : ''}`).join('\n')
}

export const test = base.extend<Fixtures>({
  _expectedErrors: async ({}, use) => {
    await use([])
  },

  expectErrors: async ({ _expectedErrors }, use) => {
    await use((...matchers) => {
      _expectedErrors.push(...matchers)
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

    await use(context)

    // A declared error the test provoked may still be on its way from the
    // browser when the test body ends: wait for it rather than fail early.
    const missing = () => _expectedErrors.filter(m => !logged.some(e => matches(m, e))).map(show)
    await expect
      .poll(missing, { message: 'expected errors were never logged', timeout: 2_000 })
      .toEqual([])

    const unexpected = logged.filter(e => !_expectedErrors.some(m => matches(m, e)))
    if (unexpected.length > 0) {
      throw new Error(`The page logged ${unexpected.length} unexpected error(s):\n${formatErrors(unexpected)}`)
    }
  },
})

export { expect }
export type { Page } from '@playwright/test'
