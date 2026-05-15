import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: Equipment task view does not refresh dynamically after marking a task as done
 * Roadmap: Milestone 1 — "Fix dynamic refresh issues"
 * Fixed in: open
 */
test('Equipment task view refreshes dynamically after marking a task as done', async ({ page }) => {
  // Arrange — create an equipment with an hour-meter and a task via API
  // Set hours high enough so the task becomes overdue (next due at 100, current 100)
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Test Equipment', tracks_hours: true, hours: 100 },
  })
  const eq = await eqRes.json()

  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Test Task', hours_interval: 100 },
  })
  const task = await taskRes.json()

  // Give the task an old intervention so baseline is 0h, next due = 0+100 = 100h
  // Current hours = 100 >= 100 → overdue
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2025-01-01T00:00:00Z', hours_at: 0 },
  })

  // Navigate to the equipment detail page
  await page.goto(`/equipments/${eq.id}`)
  await page.waitForURL(`/equipments/${eq.id}`)

  // The task should initially appear as overdue
  await expect(page.getByText('Overdue')).toBeVisible()

  // Act — open the quick-log modal and save (date is pre-filled to today)
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  // Assert — the task status changed from "Overdue" to "OK"
  await expect(page.getByText('Overdue')).not.toBeVisible()
  await expect(page.getByText('OK')).toBeVisible()
})