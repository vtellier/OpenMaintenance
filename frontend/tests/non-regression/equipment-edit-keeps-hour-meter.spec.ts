import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: saving the equipment edit form (e.g. a new name) reset the hour-meter
 *      freshness to "never updated", and the form's hours field could lower
 *      the reading. The form must only ask for hours while turning the
 *      hour-meter on, and saving metadata must leave the reading alone.
 * Fixed in: issue #69
 */
test('editing an equipment leaves its hour-meter reading and freshness alone', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Edit Keeps Hour-meter', tracks_hours: true, hours: 100 },
  })
  const eq = await eqRes.json()
  const before = await (await page.request.get(`${API}/equipments/${eq.id}`)).json()

  await page.goto(`/equipments/${eq.id}/edit`)
  const name = page.getByPlaceholder('e.g. Main Engine')
  await expect(name).toHaveValue('Edit Keeps Hour-meter')

  // Already tracking: the reading is changed through "Update hours", not here.
  await expect(page.getByText('Current hours')).toHaveCount(0)

  await name.fill('Edit Keeps Hour-meter (renamed)')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(`/equipments/${eq.id}`)

  const after = await (await page.request.get(`${API}/equipments/${eq.id}`)).json()
  expect(after.name).toBe('Edit Keeps Hour-meter (renamed)')
  expect(after.hours).toBe(100)
  expect(after.hours_updated_at).toBe(before.hours_updated_at)
  await expect(page.locator('.detail-header__hours')).not.toContainText('never')
})

test('turning the hour-meter on asks for the initial reading', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Turn On Hour-meter' },
  })
  const eq = await eqRes.json()

  await page.goto(`/equipments/${eq.id}/edit`)
  await expect(page.getByPlaceholder('e.g. Main Engine')).toHaveValue('Turn On Hour-meter')
  await expect(page.getByText('Current hours')).toHaveCount(0)

  await page.locator('.toggle-slider').click()
  const hours = page.locator('input[type="number"]')
  await expect(hours).toHaveValue('0')
  await hours.fill('42')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(`/equipments/${eq.id}`)

  const after = await (await page.request.get(`${API}/equipments/${eq.id}`)).json()
  expect(after.tracks_hours).toBe(true)
  expect(after.hours).toBe(42)
  expect(after.hours_updated_at).toBeTruthy()
})
