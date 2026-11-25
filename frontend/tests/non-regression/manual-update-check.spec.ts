import { expect, failedRequest, test, type Page } from '../fixtures'

/**
 * Feature (not a bug): Settings → About has a "Check for updates" button that
 * asks the backend to check GitHub now, shows a busy state, then the outcome
 * inline (issue #57). Both update-status routes are mocked, so the test never
 * reaches GitHub.
 */

const notCheckedYet = { current_version: 'v0.5.0', latest_version: '', update_available: false }

// Serves GET /api/update-status as "no check yet", and POST
// /api/update-status/check with checkBody once release() is called.
async function mockUpdateApi(page: Page, checkBody: object | 'abort') {
  let release!: () => void
  const released = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/update-status', route => route.fulfill({ json: notCheckedYet }))
  await page.route('**/api/update-status/check', async route => {
    await released
    if (checkBody === 'abort') await route.abort()
    else await route.fulfill({ json: checkBody })
  })
  return release
}

test('checking finds a newer version and shows its release link', async ({ page }) => {
  const release = await mockUpdateApi(page, {
    current_version: 'v0.5.0',
    latest_version: 'v0.6.0',
    update_available: true,
    release_url: 'https://github.com/vtellier/OpenMaintenance/releases/tag/v0.6.0',
    checked_at: '2026-10-04T10:00:00Z',
    cached: false,
  })
  await page.goto('/settings')

  const button = page.getByRole('button', { name: 'Check for updates' })
  await expect(button).toBeVisible()
  await expect(page.locator('.settings-about__update, .settings-about__uptodate')).toHaveCount(0)

  await button.click()
  const busy = page.getByRole('button', { name: 'Checking…' })
  await expect(busy).toBeDisabled()

  release()
  await expect(page.getByRole('button', { name: 'Check for updates' })).toBeEnabled()
  const link = page.locator('.settings-about__update a')
  await expect(link).toHaveText('⬆ v0.6.0 available — Release notes ↗')
  await expect(link).toHaveAttribute('href', 'https://github.com/vtellier/OpenMaintenance/releases/tag/v0.6.0')
  await expect(page.locator('.update-check').getByRole('status')).toHaveText('Checked just now.')
})

test('checking confirms the app is up to date, with the current version', async ({ page }) => {
  const release = await mockUpdateApi(page, {
    current_version: 'v0.5.0', latest_version: 'v0.5.0', update_available: false, cached: false,
  })
  release()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Check for updates' }).click()

  await expect(page.locator('.settings-about__uptodate')).toHaveText('✓ Up to date (v0.5.0)')
  await expect(page.locator('.update-check').getByRole('status')).toHaveText('Checked just now.')
})

test('a check less than a minute after the last one says it reused that result', async ({ page }) => {
  const release = await mockUpdateApi(page, {
    current_version: 'v0.5.0', latest_version: 'v0.5.0', update_available: false, cached: true,
  })
  release()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Check for updates' }).click()

  await expect(page.locator('.update-check').getByRole('status')).toHaveText('Already checked less than a minute ago.')
})

test('a failed check says why', async ({ page }) => {
  const release = await mockUpdateApi(page, {
    current_version: 'v0.5.0', latest_version: '', update_available: false, error: 'rate_limited', cached: false,
  })
  release()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Check for updates' }).click()

  await expect(page.locator('.update-check').getByRole('status')).toHaveText("⚠ GitHub's rate limit is reached. Try again later.")
  await expect(page.locator('.update-check__message--error')).toBeVisible()
  await expect(page.locator('.settings-about__uptodate')).toHaveCount(0)
})

test('a check that cannot reach the server says so', async ({ page, expectErrors }) => {
  expectErrors(failedRequest('/api/update-status/check', 'net::ERR_FAILED'))
  const release = await mockUpdateApi(page, 'abort')
  release()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Check for updates' }).click()

  await expect(page.locator('.update-check').getByRole('status')).toHaveText('⚠ Could not reach the OpenMaintenance server.')
  await expect(page.getByRole('button', { name: 'Check for updates' })).toBeEnabled()
})

// Set on <html> once the page has handled the page-load GET (see below).
const STATUS_HANDLED = 'data-update-status-handled'

test('a slow page-load status does not overwrite a newer check result', async ({ page }) => {
  // Nothing visible changes when the late GET is ignored, so the test needs a
  // sign that the page has handled it. An init script wraps fetch. Once the
  // page has read the GET's JSON, it marks <html> after three hops, one per
  // way a UI can schedule its re-render:
  //  - a 0 ms timer runs after every microtask, such as Arrow's re-render;
  //  - an animation frame then runs after any frame callback queued before it;
  //  - a posted message then runs after any message posted before it, the
  //    same task source React's scheduler renders in.
  // The page's handling after json() is all microtasks, so it queues its
  // re-render before the first hop runs, and the mark comes after that
  // render. Not covered: a render deferred by a longer timer, or a
  // time-sliced render (startTransition) that yields. A port of UpdateCheck
  // must check again that this test fails without the `checkStarted` guard.
  await page.addInitScript(attr => {
    const realFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await realFetch(...args)
      const url = new URL(response.url, location.href)
      if (url.pathname === '/api/update-status') {
        const realJson = response.json.bind(response)
        response.json = async () => {
          const body = await realJson()
          setTimeout(() => requestAnimationFrame(() => {
            const channel = new MessageChannel()
            channel.port1.onmessage = () => {
              channel.port1.close()
              document.documentElement.setAttribute(attr, '')
            }
            channel.port2.postMessage(null)
          }))
          return body
        }
      }
      return response
    }
  }, STATUS_HANDLED)
  let answerGet!: () => void
  const getAnswered = new Promise<void>(resolve => { answerGet = resolve })
  await page.route('**/api/update-status', async route => {
    await getAnswered
    await route.fulfill({ json: { current_version: 'v0.5.0', latest_version: 'v0.5.0', update_available: false } })
  })
  await page.route('**/api/update-status/check', route => route.fulfill({
    json: {
      current_version: 'v0.5.0',
      latest_version: 'v0.6.0',
      update_available: true,
      release_url: 'https://github.com/vtellier/OpenMaintenance/releases/tag/v0.6.0',
      cached: false,
    },
  }))
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Check for updates' }).click()
  await expect(page.locator('.settings-about__update')).toBeVisible()

  await expect(page.locator('html')).not.toHaveAttribute(STATUS_HANDLED)
  answerGet()
  await expect(page.locator('html')).toHaveAttribute(STATUS_HANDLED, '')
  await expect(page.locator('.settings-about__update')).toBeVisible()
  await expect(page.locator('.settings-about__uptodate')).toHaveCount(0)
})
