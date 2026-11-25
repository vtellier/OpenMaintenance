import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: clicking "Same hours" on the dashboard freshness reminder keeps the stale
 *      row visible — the user had to refresh the page for the notification to disappear.
 * Fixed in: open (issue #34)
 */
test('same hours dismissal removes stale row immediately without page reload', async ({ page }) => {
  // Arrange: equipment with a reading. Same hours needs a reading to confirm
  // (issue #130), and entering it marks it fresh, so the browser is shown
  // that first reading as 10 days old. The reading Same hours stores passes
  // through unchanged.
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Freshness Dismiss Equipment', tracks_hours: true, hours: 120 },
  })
  const eq = await eqRes.json()
  const staleAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

  await page.route(/\/api\/equipments(\?.*)?$/, async route => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const equipments = await response.json()
    for (const e of equipments) {
      if (e.id === eq.id && e.hours_updated_at === eq.hours_updated_at) e.hours_updated_at = staleAt
    }
    await route.fulfill({ response, json: equipments })
  })

  await page.goto('/')

  // Scope to this test's own equipment: other specs in the run also create
  // hour-tracking equipments, so the dashboard shows several stale rows.
  const staleRow = page.locator('.hours-banner__row--stale', {
    hasText: 'Freshness Dismiss Equipment',
  })

  // The stale row must be visible before the action
  await expect(staleRow).toBeVisible()

  // Act: dismiss the freshness reminder
  await staleRow.getByRole('button', { name: 'Same hours' }).click()

  // Assert: the stale row disappears immediately — no page reload needed
  await expect(staleRow).not.toBeVisible()
})
