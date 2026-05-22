import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: clicking "Enable" in the hour-meter confirmation modal re-opens it
 *      indefinitely, making it impossible to save other fields (e.g. commissioning date)
 *      on an equipment that already has hour-meter tracking and tasks with hour intervals.
 * Cause: onSubmit() re-checked tasks on every call; after the modal set
 *        showConfirmTracks=false and called onSubmit() again, the check fired again.
 */
test('confirm-tracks modal does not reopen after clicking Enable', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Hours Track Test', tracks_hours: true, hours: 50 },
  })
  const eq = await eqRes.json()
  await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Oil change', hours_interval: 100 },
  })

  await page.goto(`/equipments/${eq.id}/edit`)
  await page.waitForSelector('input[type="date"]')

  await page.fill('input[type="date"]', '2020-06-01')
  await page.click('button.btn--accent')

  // confirmation modal should appear once
  await page.waitForSelector('.modal')
  await expect(page.locator('.modal__title')).toHaveText('Enable hour-meter tracking?')

  // clicking Enable should save and navigate away — modal must not reappear
  await page.click('.modal .btn--accent')
  await page.waitForURL(`/equipments/${eq.id}`)

  await expect(page.locator('.modal')).not.toBeVisible()
})
