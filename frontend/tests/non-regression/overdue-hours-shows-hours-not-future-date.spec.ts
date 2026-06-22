import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: Overdue task with a future nextDueDate (overdue by hours, not by date)
 * shows "Overdue — in Xd" instead of hours-based info.
 * Issue: https://github.com/vtellier/OpenMaintenance/issues/52
 * Fixed in: open
 */
test('overdue-by-hours task shows hours info, not future date', async ({ page }) => {
  // Equipment tracks hours and already has 1000 h accumulated.
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Overdue Hours Test Equipment', tracks_hours: true, hours: 1000 },
  })
  const eq = await eqRes.json()

  // Task is overdue by hours (hours_interval=500, current=1000).
  // months_interval=24 gives a nextDueDate ~24 months in the future, which must
  // NOT be shown as "in Xd" on an already-overdue task.
  await page.request.post(`${API}/tasks`, {
    data: {
      equipment_id: eq.id,
      name: 'Overdue Hours Test Task',
      hours_interval: 500,
      months_interval: 24,
    },
  })

  await page.goto(`/equipments/${eq.id}`)

  // The task must be flagged overdue.
  const overdueIndicator = page.locator('.due-indicator--overdue')
  await expect(overdueIndicator).toBeVisible()

  // Fixed behaviour: shows hours-based info ("at 500 h"), not a future date ("in Xd").
  await expect(overdueIndicator).toContainText('at 500 h')
})
