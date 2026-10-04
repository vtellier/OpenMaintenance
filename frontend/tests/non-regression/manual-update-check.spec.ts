import { expect, test, type Page } from '@playwright/test'

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

test('a check that cannot reach the server says so', async ({ page }) => {
  const release = await mockUpdateApi(page, 'abort')
  release()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Check for updates' }).click()

  await expect(page.locator('.update-check').getByRole('status')).toHaveText('⚠ Could not reach the OpenMaintenance server.')
  await expect(page.getByRole('button', { name: 'Check for updates' })).toBeEnabled()
})
