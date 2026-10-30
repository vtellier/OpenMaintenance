import { expect, test, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: editing the intervention that raised the reading to 500 h down to
 *      450 h must not lower the reading silently. Decided: the user is asked
 *      to keep or correct it, and Correct is prefilled with the highest
 *      reading left, the edited intervention's new reading included (450).
 *      Pinned on both pages that edit interventions: the equipment's history
 *      and the global History.
 * Fixed in: issue #70
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** An equipment at 500 h, set by its latest intervention; an older one recorded 300 h. */
async function seed(page: Page, name: string, taskName: string) {
  const eq = await (await page.request.post(`${API}/equipments`, {
    data: { name, tracks_hours: true, hours: 100 },
  })).json()
  const task = await (await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: taskName, hours_interval: 100 },
  })).json()
  await page.request.post(`${API}/interventions`, { data: { task_id: task.id, date: daysAgo(10), hours_at: 300 } })
  await page.request.post(`${API}/interventions`, { data: { task_id: task.id, date: daysAgo(1), hours_at: 500 } })
  return eq.id as number
}

/** Edits the 500 h intervention shown in `rows` down to 450 h, then Correct. */
async function editTo450AndCorrect(page: Page, id: number, rows: ReturnType<Page['locator']>) {
  await rows.filter({ hasText: '500 h' }).getByRole('button', { name: 'Edit' }).click()
  const modal = page.locator('.modal')
  const hours = modal.locator('.form-field').filter({ hasText: 'Hours' }).locator('input')
  await expect(hours).toHaveValue('500')
  await hours.fill('450')
  await modal.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { name: 'Keep the hour-meter reading?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep the reading' })).toBeFocused()
  const before = await (await page.request.get(`${API}/equipments/${id}`)).json()
  expect(before.hours).toBe(500)

  await page.getByRole('button', { name: 'Correct the reading' }).click()
  await page.waitForURL(`/equipments/${id}/edit/hours/correct?hours=450`)
  await expect(page.getByLabel('Corrected reading')).toHaveValue('450')
}

test('editing the intervention that set the reading down asks, and Correct is prefilled with its new reading', async ({ page }) => {
  const id = await seed(page, 'Reading Doubt Edit', 'Reading doubt edit service')

  await page.goto(`/equipments/${id}/history`)
  await editTo450AndCorrect(page, id, page.locator('.history-item'))
})

test('editing it down from the global History asks too', async ({ page }) => {
  const id = await seed(page, 'Reading Doubt Edit History', 'Reading doubt global service')

  await page.goto('/history')
  await editTo450AndCorrect(page, id, page.locator('.history-item').filter({ hasText: 'Reading doubt global service' }))
})
