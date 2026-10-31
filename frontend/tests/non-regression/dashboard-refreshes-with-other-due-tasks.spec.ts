import { expect, Page, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: after Done was saved on the Dashboard, the task stayed listed as
 * overdue whenever another equipment still had a due task. The due list's
 * equipment blocks and task rows were static arrays inside a reactive slot,
 * so they kept their first render (Arrow.js skill, Gotcha 9).
 * Issue: #109
 * Fixed in: open
 */

async function equipmentWithDueTask(page: Page, name: string, equipment: Record<string, unknown>, lastDone: string) {
  const eq = await (await page.request.post(`${API}/equipments`, { data: { name, ...equipment } })).json()
  const task = await (await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: `${name} Task`, months_interval: 1 },
  })).json()
  await page.request.post(`${API}/interventions`, { data: { task_id: task.id, date: lastDone } })
  return { eq, task, taskName: `${name} Task` }
}

test('Done on the Dashboard removes the task while another equipment keeps its due task', async ({ page }) => {
  // Overdue, so its block comes first; the other block, only due soon (done
  // 20 days ago on a monthly task), then moves up into its place.
  const done = await equipmentWithDueTask(page, 'Refresh First Boat', { tracks_hours: true, hours: 100 }, '2024-01-01T00:00:00Z')
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
  const other = await equipmentWithDueTask(page, 'Refresh Second Car', { tracks_hours: false }, twentyDaysAgo)

  await page.goto('/')
  await page.locator('.task-row', { hasText: done.taskName }).getByRole('button', { name: 'Done' }).click()
  const modal = page.locator('.modal')
  await modal.getByRole('button', { name: 'Save' }).click()
  await expect(modal).toBeHidden()

  await expect(page.locator('.task-row', { hasText: done.taskName })).toHaveCount(0)
  // The remaining block is the other equipment's, whole.
  const block = page.locator('.equipment-block', { hasText: other.eq.name })
  await expect(block.locator('.equipment-block__name')).toHaveAttribute('href', `/equipments/${other.eq.id}`)
  await expect(block.locator('.equipment-block__hours')).toHaveCount(0)
  const otherRow = block.locator('.task-row', { hasText: other.taskName })
  await expect(otherRow.locator('.due-indicator')).toHaveText(/^Due soon \u2014 in \d+d$/)
  await expect(otherRow.locator('.due-indicator')).toHaveClass(/due-indicator--due-soon/)

  await block.getByRole('button', { name: 'Done' }).click()
  await expect(modal.locator('.form-field', { hasText: 'Task *' }).locator('select')).toHaveValue(String(other.task.id))
})
