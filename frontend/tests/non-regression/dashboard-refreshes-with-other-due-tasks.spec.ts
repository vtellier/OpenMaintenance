import { API, expect, Page, test } from '../fixtures'

/**
 * Bug: after Done was saved on the Dashboard, the task stayed listed as
 * overdue whenever another equipment still had a due task. The due list's
 * equipment blocks and task rows were static arrays inside a reactive slot,
 * so they kept their first render (Arrow.js skill, Gotcha 9).
 * Issue: #109
 * Fixed in: open
 */

async function equipmentWithDueTask(page: Page, name: string, equipment: Record<string, unknown>, lastDone: string, monthsInterval = 1) {
  const eq = await (await page.request.post(`${API}/equipments`, { data: { name, ...equipment } })).json()
  const task = await (await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: `${name} Task`, months_interval: monthsInterval },
  })).json()
  await page.request.post(`${API}/interventions`, { data: { task_id: task.id, date: lastDone } })
  return { eq, task, taskName: `${name} Task` }
}

test('Done on the Dashboard removes the task while another equipment keeps its due task', async ({ page }) => {
  // Overdue, so its block ranks above the other one, only due soon (done 20
  // days ago on a monthly task), which then moves up into its place. Not
  // necessarily first: earlier specs leave more urgent overdue tasks behind.
  // A yearly task: done today, it is OK in any month. A monthly one would be
  // due soon at once whenever next month's date is 30 days away or less (#116).
  const done = await equipmentWithDueTask(page, 'Refresh First Boat', { tracks_hours: true, hours: 100 }, '2024-01-01T00:00:00Z', 12)
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
  await expect(modal.getByLabel('Task', { exact: true })).toHaveValue(String(other.task.id))
})
