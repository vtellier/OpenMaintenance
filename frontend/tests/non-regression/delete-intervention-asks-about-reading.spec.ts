import { expect, test, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: deleting the intervention that raised the reading to 500 h left the
 *      equipment at 500 h, while the confirmation promised "Equipment hours
 *      ... will be recomputed from the remaining history", and nothing could
 *      correct a wrong reading. Decided: the reading is never lowered
 *      silently; when it may have come from the deleted intervention, the user
 *      chooses to keep it (the default) or to correct it, prefilled with the
 *      highest reading left.
 * Fixed in: issue #70
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** An equipment at 500 h, set by its latest intervention; an older one recorded 300 h. */
async function seed(page: Page, name: string) {
  const eq = await (await page.request.post(`${API}/equipments`, {
    data: { name, tracks_hours: true, hours: 100 },
  })).json()
  const task = await (await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Reading doubt service', hours_interval: 100 },
  })).json()
  await page.request.post(`${API}/interventions`, { data: { task_id: task.id, date: daysAgo(10), hours_at: 300 } })
  await page.request.post(`${API}/interventions`, { data: { task_id: task.id, date: daysAgo(1), hours_at: 500 } })
  return eq.id as number
}

async function deleteThe500hIntervention(page: Page, id: number) {
  await page.goto(`/equipments/${id}/history`)
  const row = page.locator('.history-item').filter({ hasText: '500 h' })
  await row.getByRole('button', { name: 'Del' }).click()
  await expect(page.getByText('The equipment\'s hour-meter reading is not lowered.')).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Keep the hour-meter reading?' })).toBeVisible()
}

test('deleting the intervention that set the reading asks, and Keep leaves the reading', async ({ page }) => {
  const id = await seed(page, 'Reading Doubt Keep')
  const before = await (await page.request.get(`${API}/equipments/${id}`)).json()
  expect(before.hours).toBe(500)

  await deleteThe500hIntervention(page, id)
  const keep = page.getByRole('button', { name: 'Keep the reading' })
  await expect(keep).toBeFocused()
  await keep.click()

  await expect(page.getByRole('heading', { name: 'Keep the hour-meter reading?' })).toHaveCount(0)
  await expect(page.locator('.history-item').filter({ hasText: '500 h' })).toHaveCount(0)
  await expect(page.locator('.detail-header__hours')).toContainText('500 h')
  const after = await (await page.request.get(`${API}/equipments/${id}`)).json()
  expect(after.hours).toBe(500)
  expect(after.hours_updated_at).toBe(before.hours_updated_at)
})

test('deleting the intervention that set the reading asks, and Correct sets the prefilled reading', async ({ page }) => {
  const id = await seed(page, 'Reading Doubt Correct')

  await deleteThe500hIntervention(page, id)
  await page.getByRole('button', { name: 'Correct the reading' }).click()

  await page.waitForURL(`/equipments/${id}/edit/hours/correct?hours=300`)
  await expect(page.getByLabel('Corrected reading')).toHaveValue('300')
  await page.getByRole('button', { name: 'Correct reading' }).click()

  await page.waitForURL(`/equipments/${id}`)
  await expect(page.locator('.detail-header__hours')).toContainText('300 h')
  const after = await (await page.request.get(`${API}/equipments/${id}`)).json()
  expect(after.hours).toBe(300)
  expect(Date.now() - new Date(after.hours_updated_at).getTime()).toBeLessThan(60_000)
})

test('deleting an intervention below the current reading does not ask', async ({ page }) => {
  const id = await seed(page, 'Reading Doubt None')

  await page.goto(`/equipments/${id}/history`)
  const row = page.locator('.history-item').filter({ hasText: '300 h' })
  await row.getByRole('button', { name: 'Del' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.locator('.history-item').filter({ hasText: '300 h' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Keep the hour-meter reading?' })).toHaveCount(0)
  await expect(page.locator('.detail-header__hours')).toContainText('500 h')
})
