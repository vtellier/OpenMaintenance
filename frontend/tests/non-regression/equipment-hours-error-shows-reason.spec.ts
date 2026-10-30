import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: the equipment create modal and the "Update hours" page showed a
 * generic "Failed to add equipment" / "Failed to update hours" instead of
 * the backend's reason, so a refused reading (e.g. a negative one) gave the
 * user no clue what to fix.
 * Issue: #102
 * Fixed in: open
 */
test('creating an equipment with negative hours shows the reason', async ({ page }) => {
  await page.goto('/equipments')
  await page.getByRole('button', { name: '+ Add equipment' }).click()

  const modal = page.locator('.modal')
  await modal.getByPlaceholder('e.g. Main Engine').fill('Negative Hours Engine')
  await modal.locator('.toggle-row').locator('.toggle-slider').click()
  await modal.locator('.form-field').filter({ hasText: 'Initial hours' }).locator('input').fill('-5')
  await modal.getByRole('button', { name: 'Save' }).click()

  await expect(modal.locator('.flash--error')).toHaveText('Hours cannot be negative')
})

test("a refused Update hours shows the backend's reason", async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Update Hours Reason Engine', tracks_hours: true, hours: 100 },
  })
  const eq = await eqRes.json()

  await page.goto(`/equipments/${eq.id}/edit/hours`)
  await expect(page.getByRole('heading', { name: 'Update hours' })).toBeVisible()
  await page.locator('.form-field').filter({ hasText: 'New hours' }).locator('input').fill('150')

  // The reading moves on elsewhere while the page is open: 150 is now lower
  // than the current reading, and the server refuses it.
  await page.request.put(`${API}/equipments/${eq.id}/hours`, { data: { hours: 200 } })
  await page.getByRole('button', { name: 'Update hours' }).click()

  await expect(page.locator('.flash--error')).toHaveText(
    'hours cannot be lower than the current reading (200 h)',
  )
})
