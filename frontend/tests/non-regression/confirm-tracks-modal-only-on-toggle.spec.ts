import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: saving other fields (e.g. commissioning date) on an equipment that already
 *      has hour-meter tracking enabled spuriously shows the "Enable hour-meter
 *      tracking?" confirmation modal — the modal must only appear when the user
 *      toggles tracks_hours from off → on.
 * Fixed in: open (issue #9)
 */
test('confirm-tracks modal does not appear when hour-meter was already enabled', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Confirm Tracks No-Spurious Modal', tracks_hours: true, hours: 50 },
  })
  const eq = await eqRes.json()
  await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Filter change', hours_interval: 100 },
  })

  await page.goto(`/equipments/${eq.id}/edit`)
  await page.waitForSelector('input[type="date"]')

  // Change commissioning date only — hour-meter toggle untouched
  await page.fill('input[type="date"]', '2021-06-01')
  await page.getByRole('button', { name: 'Save' }).click()

  // Should navigate away without showing the confirmation modal
  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.modal')).not.toBeVisible()
})
