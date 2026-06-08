import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: clicking "Same hours" on the dashboard freshness reminder keeps the stale
 *      row visible — the user had to refresh the page for the notification to disappear.
 * Fixed in: open (issue #34)
 */
test('same hours dismissal removes stale row immediately without page reload', async ({ page }) => {
  // Arrange: equipment with hours tracking — hoursUpdatedAt is null on creation → always stale
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Freshness Dismiss Equipment', tracks_hours: true },
  })
  const eq = await eqRes.json()
  void eq

  await page.goto('/')

  // The stale row must be visible before the action
  await expect(page.locator('.hours-banner__row--stale')).toBeVisible()

  // Act: dismiss the freshness reminder
  await page.getByRole('button', { name: 'Same hours' }).click()

  // Assert: the stale row disappears immediately — no page reload needed
  await expect(page.locator('.hours-banner__row--stale')).not.toBeVisible()
})
