import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: the Tasks tab's empty state, and editing and deleting a
 * task (doc/gui/tasks.md, "Empty state", "Validation rules", "Flow: Edit a
 * task", "Flow: Delete a task"). Adding one is pinned by
 * task-list-appears-after-add.spec.ts and expiry-task-happy-path.spec.ts.
 * Issue: #150
 */

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}${path}`, { data })
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

test('an equipment with no task says so, and its first task needs an interval before it can be saved', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Task Empty Bilge Pump' })

  await page.goto(`/equipments/${eq.id}`)
  await expect(page.getByText('No maintenance tasks yet for this equipment.')).toBeVisible()
  await page.getByRole('link', { name: 'Add the first task' }).click()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Add task' })).toBeVisible()
  await expect(modal.getByRole('radio', { name: 'Interval' })).toBeChecked()
  // No hour-meter: no hours interval.
  await expect(modal.getByPlaceholder('e.g. 100')).toHaveCount(0)
  const save = modal.getByRole('button', { name: 'Save' })
  await expect(save).toBeDisabled()
  await modal.getByPlaceholder('e.g. Oil change').fill('Task Empty Check float')
  await expect(save).toBeDisabled()
  await modal.getByPlaceholder('e.g. 6').fill('6')
  await expect(save).toBeEnabled()
  await save.click()

  await expect(modal).toBeHidden()
  await expect(page.locator('.task-row').filter({ hasText: 'Task Empty Check float' })).toBeVisible()
  await expect(page.getByText('No maintenance tasks yet for this equipment.')).toHaveCount(0)
})

test('Edit opens the task form prefilled, without the kind choice, and saves the change', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Task Edit Outboard', tracks_hours: true, hours: 10 })
  const task = await post(page, '/tasks', {
    equipment_id: eq.id, name: 'Task Edit Impeller', description: 'Task Edit spare in locker', hours_interval: 100, months_interval: 6,
  })

  await page.goto(`/equipments/${eq.id}`)
  await page.locator('.task-row').filter({ hasText: 'Task Edit Impeller' }).getByRole('button', { name: 'Edit' }).click()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Edit task' })).toBeVisible()
  await expect(modal.getByText('Interval task')).toBeVisible()
  await expect(modal.getByRole('radio')).toHaveCount(0)
  const name = modal.getByPlaceholder('e.g. Oil change')
  await expect(name).toHaveValue('Task Edit Impeller')
  await expect(modal.getByPlaceholder('Optional')).toHaveValue('Task Edit spare in locker')
  await expect(modal.getByPlaceholder('e.g. 100')).toHaveValue('100')
  await expect(modal.getByPlaceholder('e.g. 6')).toHaveValue('6')

  await name.fill('Task Edit Impeller and seals')
  await modal.getByPlaceholder('e.g. 6').fill('12')
  await modal.getByRole('button', { name: 'Save' }).click()

  await expect(modal).toBeHidden()
  const row = page.locator('.task-row').filter({ hasText: 'Task Edit Impeller and seals' })
  await expect(row).toContainText('Every 100h or 12mo')
  const saved = await (await page.request.get(`${API}/tasks/${task.id}`)).json()
  expect(saved).toMatchObject({ name: 'Task Edit Impeller and seals', hours_interval: 100, months_interval: 12 })
})

test('Delete warns that the task\'s interventions go too, then removes both', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Task Delete Windlass' })
  const task = await post(page, '/tasks', { equipment_id: eq.id, name: 'Task Delete Grease gypsy', months_interval: 12 })
  await post(page, '/tasks', { equipment_id: eq.id, name: 'Task Delete Kept task', months_interval: 12 })
  await post(page, '/interventions', { task_id: task.id, date: '2026-02-03T12:00:00Z' })

  await page.goto(`/equipments/${eq.id}`)
  const row = page.locator('.task-row').filter({ hasText: 'Task Delete Grease gypsy' })
  await row.getByRole('button', { name: 'Del' }).click()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Delete task' })).toBeVisible()
  await expect(modal).toContainText('Task Delete Grease gypsy')
  await expect(modal).toContainText('All interventions recorded for this task will also be deleted.')
  await modal.getByRole('button', { name: 'Delete' }).click()

  await expect(modal).toBeHidden()
  await expect(row).toHaveCount(0)
  await expect(page.locator('.task-row').filter({ hasText: 'Task Delete Kept task' })).toBeVisible()

  await page.locator('.sub-tabs').getByRole('link', { name: 'History' }).click()
  await expect(page.getByText('No history yet for this equipment.')).toBeVisible()
})
