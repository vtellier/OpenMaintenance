import { API, expect, test } from '../fixtures'

/**
 * Bug: the dashboard hour-meter banner offered "Same hours" for an equipment
 *      that tracks hours but has no reading yet, and one tap recorded 0 h the
 *      user never entered.
 * Fixed in: open (issue #130)
 */
test('an equipment with no reading yet is offered only Update, not Same hours', async ({ page }) => {
  // Arrange: tracks hours, no initial reading entered.
  const name = 'No Reading Banner Equipment'
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name, tracks_hours: true },
  })
  expect(eqRes.ok()).toBeTruthy()

  await page.goto('/')

  const row = page.locator('.hours-banner__row', { hasText: name })

  // The row stays in the banner, with Update to enter the first reading...
  await expect(row).toBeVisible()
  await expect(row.getByRole('link', { name: 'Update' })).toBeVisible()
  // ...but there is no reading to confirm.
  await expect(row.getByRole('button', { name: 'Same hours' })).toHaveCount(0)
})
