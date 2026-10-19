import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: a failed Dashboard quick log showed a generic "Failed to save
 * intervention" instead of the backend's reason (the #51 fix reached
 * Equipment detail and History only).
 * Issue: #74
 * Fixed in: open
 */
test("a refused Dashboard quick log shows the backend's reason", async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Quick Log Error Boat', tracks_hours: false },
  })
  const eq = await eqRes.json()
  const taskName = 'Quick Log Error Task'
  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: taskName, months_interval: 1 },
  })
  const task = await taskRes.json()
  // An old intervention makes the task overdue, so the Dashboard lists it.
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2025-01-01T00:00:00Z' },
  })

  await page.goto('/')
  await page.locator('.task-row', { hasText: taskName }).getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText(`Mark done: ${taskName}`)).toBeVisible()

  // The backend refuses a future date with {"error": "intervention date cannot be in the future"}.
  await page.locator('.modal input[type="date"]').fill('2099-12-31')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.locator('.modal .flash--error')).toHaveText('intervention date cannot be in the future')
})
