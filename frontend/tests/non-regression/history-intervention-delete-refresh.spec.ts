import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: History intervention list does not refresh dynamically after deleting an intervention
 * Roadmap: Milestone 1 — "Fix dynamic refresh issues"
 * Fixed in: open
 */
test('History intervention list refreshes dynamically after deleting an intervention', async ({ page }) => {
  // Arrange — create an equipment, a task, and an intervention via API
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Delete Test Equipment', tracks_hours: false },
  })
  const eq = await eqRes.json()

  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Delete Test Task', months_interval: 6 },
  })
  const task = await taskRes.json()

  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2026-01-15T00:00:00Z' },
  })

  // Navigate to the history page
  await page.goto('/history')
  await page.waitForURL('/history')

  // The intervention should be visible
  const itemRow = page.locator('.history-item').filter({ hasText: 'Delete Test Task' })
  await expect(itemRow).toBeVisible()

  // Act — delete the intervention
  await itemRow.getByRole('button', { name: 'Del' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()

  // Assert — the intervention is no longer in the list
  await expect(page.getByText('Delete Test Task')).not.toBeVisible()
})