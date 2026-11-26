import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: turning the hour-meter off, then on again, from the
 * equipment's edit form (doc/gui/equipments.md, "Flow: Toggle hour-meter on
 * an existing equipment"). Turning it on for the first time is pinned by
 * equipment-edit-keeps-hour-meter.spec.ts.
 * Issue: #150
 */

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}${path}`, { data })
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

test('turned back on, the hour-meter is prefilled with its last reading and cannot go lower', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Toggle Hours Again Engine', tracks_hours: true, hours: 120 })
  const off = await page.request.put(`${API}/equipments/${eq.id}`, {
    data: { name: 'Toggle Hours Again Engine', tracks_hours: false },
  })
  expect(off.ok(), await off.text()).toBeTruthy()

  await page.goto(`/equipments/${eq.id}/edit`)
  await expect(page.getByPlaceholder('e.g. Main Engine')).toHaveValue('Toggle Hours Again Engine')
  await page.getByRole('checkbox', { name: 'This equipment has an hour-meter' }).check()
  const hours = page.getByLabel('Current hours')
  await expect(hours).toHaveValue('120')

  const save = page.getByRole('button', { name: 'Save' })
  await hours.fill('100')
  await expect(save).toBeDisabled()
  await hours.fill('130')
  await save.click()

  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.detail-header__hours')).toContainText('130 h')
})

// The form saves at once, with no warning.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/171
test.fixme('turning the hour-meter off asks first when a task uses an hours interval', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Toggle Hours Off Engine', tracks_hours: true, hours: 50 })
  await post(page, '/tasks', { equipment_id: eq.id, name: 'Toggle Hours Off Oil service', hours_interval: 100 })

  await page.goto(`/equipments/${eq.id}/edit`)
  await expect(page.getByPlaceholder('e.g. Main Engine')).toHaveValue('Toggle Hours Off Engine')
  await page.getByRole('checkbox', { name: 'This equipment has an hour-meter' }).uncheck()
  await page.getByRole('button', { name: 'Save' }).click()

  // The app warns that the tasks using an hours interval are affected, and
  // saves only once the user confirms.
  await expect(page.locator('.modal')).toContainText(/hour/i)
  const still = await (await page.request.get(`${API}/equipments/${eq.id}`)).json()
  expect(still.tracks_hours).toBe(true)
})
