import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: saving an intervention with a future date shows a generic error
 * "Failed to save intervention" instead of the backend's reason
 * "intervention date cannot be in the future".
 * Fixed in: open
 */
test('saving an intervention with a future date shows the specific backend error', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Error Message Test Equipment', tracks_hours: false },
  })
  const eq = await eqRes.json()

  await page.goto('/history')
  await page.getByRole('button', { name: '+ Log intervention' }).click()

  // Fill the form: equipment + exceptional label + a future date.
  const modal = page.locator('.modal')
  await modal.locator('select').nth(0).selectOption(String(eq.id))
  await page.getByLabel('Exceptional intervention').check()
  await page.getByPlaceholder('e.g. Replaced broken impeller').fill('Future test')
  await page.locator('.modal input[type="date"]').fill('2099-12-31')

  await page.getByRole('button', { name: 'Save' }).click()

  // The backend returns 400 with {"error": "intervention date cannot be in the future"}.
  // The UI must surface that reason, not a generic fallback.
  const errorFlash = page.locator('.flash--error')
  await expect(errorFlash).toBeVisible()
  await expect(errorFlash).not.toContainText('Failed to save intervention')
  await expect(errorFlash).toContainText('future')
})
