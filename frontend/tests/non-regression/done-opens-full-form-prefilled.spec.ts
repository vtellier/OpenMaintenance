import { expect, Page, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Feature: Done on a task row opens the full intervention form, prefilled
 * (its equipment and task selected, today, the current reading), instead of
 * the quick log. Saving logs the intervention and refreshes the list.
 * Issue: #107
 * Fixed in: open
 */

async function equipmentWithOverdueTask(page: Page, name: string, equipment: Record<string, unknown>) {
  const eq = await (await page.request.post(`${API}/equipments`, { data: { name, ...equipment } })).json()
  const taskName = `${name} Task`
  const task = await (await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: taskName, months_interval: 1 },
  })).json()
  // An old intervention makes the task overdue, so the Dashboard lists it.
  await page.request.post(`${API}/interventions`, { data: { task_id: task.id, date: '2025-01-01T00:00:00Z' } })
  return { eq, task, taskName }
}

/** Today in the browser's timezone, as the date input shows it. */
function localToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

test('Done on the Dashboard opens the full form prefilled and saves it', async ({ page }) => {
  const { eq, task, taskName } = await equipmentWithOverdueTask(page, 'Done Full Form Boat', { tracks_hours: true, hours: 100 })

  await page.goto('/')
  const row = page.locator('.task-row', { hasText: taskName })
  await row.getByRole('button', { name: 'Done' }).click()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Log intervention' })).toBeVisible()
  await expect(modal.locator('.form-field', { hasText: 'Equipment *' }).locator('select')).toHaveValue(String(eq.id))
  await expect(modal.getByLabel('Exceptional intervention')).not.toBeChecked()
  await expect(modal.locator('.form-field', { hasText: 'Task *' }).locator('select')).toHaveValue(String(task.id))
  await expect(modal.locator('input[type="date"]')).toHaveValue(await localToday(page))
  await expect(modal.locator('.form-field', { hasText: 'Hours' }).locator('input')).toHaveValue('100')
  await expect(modal.getByText('Save the intervention to attach photos.')).toBeVisible()

  // The location the quick log used to ask for (#97) is saved, trimmed.
  await modal.locator('.form-field', { hasText: 'Location' }).locator('input').fill('  Marina Done  ')
  await modal.getByRole('button', { name: 'Save' }).click()
  await expect(modal).toBeHidden()
  // The task is no longer due: it leaves the Dashboard.
  await expect(row).toHaveCount(0)

  const interventions: { location?: string | null }[] = await (await page.request.get(`${API}/tasks/${task.id}/interventions`)).json()
  expect(interventions.map(i => i.location ?? null)).toContain('Marina Done')
})

test('Done on Equipment detail opens the full form prefilled, with no reading invented, and refreshes the tasks', async ({ page }) => {
  // Tracks hours but has no reading yet: the form leaves the hours empty.
  const { eq, task, taskName } = await equipmentWithOverdueTask(page, 'Done Full Form Generator', { tracks_hours: true })

  await page.goto(`/equipments/${eq.id}`)
  const row = page.locator('.task-row', { hasText: taskName })
  await expect(row).toContainText('Overdue')
  const lastBefore = await row.locator('.task-row__meta', { hasText: 'Last:' }).innerText()
  await row.getByRole('button', { name: 'Done' }).click()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Log intervention' })).toBeVisible()
  // Opened from the equipment's page: no equipment picker.
  await expect(modal.locator('.form-field', { hasText: 'Equipment *' })).toHaveCount(0)
  await expect(modal.locator('.form-field', { hasText: 'Task *' }).locator('select')).toHaveValue(String(task.id))
  await expect(modal.locator('input[type="date"]')).toHaveValue(await localToday(page))
  await expect(modal.locator('.form-field', { hasText: 'Hours' }).locator('input')).toHaveValue('')

  await modal.getByRole('button', { name: 'Save' }).click()
  await expect(modal).toBeHidden()
  // The Tasks tab refreshes: a new last date, no longer overdue.
  await expect(row.locator('.task-row__meta', { hasText: 'Last:' })).not.toHaveText(lastBefore)
  await expect(row).not.toContainText('Overdue')

  const interventions: { hours_at?: number | null }[] = await (await page.request.get(`${API}/tasks/${task.id}/interventions`)).json()
  expect(interventions).toHaveLength(2)
  expect(interventions.every(i => i.hours_at == null)).toBe(true)
})
