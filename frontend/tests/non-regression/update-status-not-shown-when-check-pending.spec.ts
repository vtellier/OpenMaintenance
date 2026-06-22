import { expect, test } from '@playwright/test'

/**
 * Bug: settings page shows "✓ Up to date" even when the GitHub release check
 *      has not completed (or failed) — latest_version is empty in that case,
 *      meaning we do not actually know whether an update is available.
 * Fixed in: open (issue #49)
 */
test('settings page does not show "up to date" when the update check has not returned a version', async ({ page }) => {
  // Simulate the race condition: the backend goroutine that queries the GitHub
  // Releases API hasn't finished yet, so latest_version is empty.
  await page.route('**/api/update-status', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current_version: 'v0.4.1',
        latest_version: '',
        update_available: false,
      }),
    })
  )

  await page.goto('/settings')

  // With an empty latest_version we cannot confirm the app is up to date.
  // The page must NOT display "✓ Up to date" until the check has a real result.
  await expect(page.locator('.settings-about__uptodate')).not.toBeVisible()
})

test('settings page shows update notification when a newer version is available', async ({ page }) => {
  await page.route('**/api/update-status', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current_version: 'v0.4.1',
        latest_version: 'v0.5.0',
        update_available: true,
        release_url: 'https://github.com/vtellier/OpenMaintenance/releases/tag/v0.5.0',
      }),
    })
  )

  await page.goto('/settings')

  await expect(page.locator('.settings-about__update')).toBeVisible()
  await expect(page.getByText('v0.5.0 available')).toBeVisible()
})

test('settings page shows "up to date" only when the check completed and confirmed no update', async ({ page }) => {
  await page.route('**/api/update-status', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current_version: 'v0.5.0',
        latest_version: 'v0.5.0',
        update_available: false,
      }),
    })
  )

  await page.goto('/settings')

  await expect(page.locator('.settings-about__uptodate')).toBeVisible()
})

test('settings page does not show "up to date" when the update check API call fails', async ({ page }) => {
  await page.route('**/api/update-status', route => route.abort())

  await page.goto('/settings')

  await expect(page.locator('.settings-about__uptodate')).not.toBeVisible()
})
