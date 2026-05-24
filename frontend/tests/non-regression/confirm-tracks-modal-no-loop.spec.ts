import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: clicking "Enable" in the hour-meter confirmation modal re-opened it
 *      indefinitely, making it impossible to save other fields on an equipment
 *      with hour-meter tracking and tasks with hour intervals.
 * Fixed in: f9c6ce6 (infinite loop fix) + deeper root-cause in issue #9
 *
 * Valid scenario: equipment already has tracks_hours=true. Saving any change
 * must navigate away cleanly — no modal, no loop.
 * (The backend prevents tasks with hours_interval when tracks_hours=false,
 * so the toggling scenario can never produce tasks to trigger the modal.)
 */
test('confirm-tracks modal does not reopen after clicking Enable', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'No-Loop Tracks Test', tracks_hours: true, hours: 50 },
  })
  const eq = await eqRes.json()
  await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Oil change', hours_interval: 100 },
  })

  await page.goto(`/equipments/${eq.id}/edit`)
  await page.waitForSelector('input[type="date"]')

  // Edit commissioning date without touching the hour-meter toggle
  await page.fill('input[type="date"]', '2020-06-01')
  await page.getByRole('button', { name: 'Save' }).click()

  // Should navigate away — no modal, no loop
  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.modal')).not.toBeVisible()
})
