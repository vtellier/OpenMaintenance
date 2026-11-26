import { API, apiPost, expect, test } from '../fixtures'

/**
 * Flow, not a bug: turning the hour-meter off, then on again, from the
 * equipment's edit form (doc/gui/equipments.md, "Flow: Toggle hour-meter on
 * an existing equipment"). Turning it on for the first time is pinned by
 * equipment-edit-keeps-hour-meter.spec.ts.
 * Issue: #150
 */

const HOUR_METER = 'This equipment has an hour-meter'

/** The warning names the task with an hours interval, or says what is affected. */
function hoursTasksWarning(taskName: string) {
  return new RegExp(`${taskName}|hours? intervals?|hour-based`, 'i')
}

test('turned back on, the hour-meter is prefilled with its last reading and cannot go lower', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Toggle Hours Again Engine', tracks_hours: true, hours: 120 })
  const off = await page.request.put(`${API}/equipments/${eq.id}`, {
    data: { name: 'Toggle Hours Again Engine', tracks_hours: false },
  })
  expect(off.ok(), await off.text()).toBeTruthy()

  await page.goto(`/equipments/${eq.id}/edit`)
  await expect(page.getByPlaceholder('e.g. Main Engine')).toHaveValue('Toggle Hours Again Engine')
  await page.getByRole('checkbox', { name: HOUR_METER }).check()
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
test.fixme('turning the hour-meter off warns about the tasks with an hours interval, and saves once confirmed', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Toggle Hours Off Engine', tracks_hours: true, hours: 50 })
  await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Toggle Hours Off Oil service', hours_interval: 100 })

  await page.goto(`/equipments/${eq.id}/edit`)
  await expect(page.getByPlaceholder('e.g. Main Engine')).toHaveValue('Toggle Hours Off Engine')
  await page.getByRole('checkbox', { name: HOUR_METER }).uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // A warning about the tasks that use an hours interval; nothing saved yet.
  const modal = page.locator('.modal')
  await expect(modal).toContainText(hoursTasksWarning('Toggle Hours Off Oil service'))
  expect((await (await page.request.get(`${API}/equipments/${eq.id}`)).json()).tracks_hours).toBe(true)

  // Confirming (the modal's one button besides Cancel) saves the change.
  await modal.getByRole('button').filter({ hasNotText: 'Cancel' }).click()
  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.getByRole('heading', { name: 'Toggle Hours Off Engine', level: 1 })).toBeVisible()
  await expect(page.locator('.detail-header__hours')).toHaveCount(0)
  // The last reading is kept, hidden, for when the hour-meter is turned back on.
  expect(await (await page.request.get(`${API}/equipments/${eq.id}`)).json()).toMatchObject({ tracks_hours: false, hours: 50 })
})

// The form saves at once, with no warning.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/171
test.fixme('Cancel on the hour-meter warning keeps the hour-meter on', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Toggle Hours Kept Engine', tracks_hours: true, hours: 50 })
  await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Toggle Hours Kept Oil service', hours_interval: 100 })

  await page.goto(`/equipments/${eq.id}/edit`)
  await expect(page.getByPlaceholder('e.g. Main Engine')).toHaveValue('Toggle Hours Kept Engine')
  await page.getByRole('checkbox', { name: HOUR_METER }).uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  const modal = page.locator('.modal')
  await expect(modal).toContainText(hoursTasksWarning('Toggle Hours Kept Oil service'))
  await modal.getByRole('button', { name: 'Cancel' }).click()

  await expect(modal).toHaveCount(0)
  expect(await (await page.request.get(`${API}/equipments/${eq.id}`)).json()).toMatchObject({ tracks_hours: true, hours: 50 })
})
