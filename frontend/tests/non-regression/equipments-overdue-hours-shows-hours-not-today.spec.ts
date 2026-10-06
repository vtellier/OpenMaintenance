import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: on the Equipments page, a task overdue by hours whose calendar due date
 * is still in the future shows "Overdue — today" instead of the hours overdue.
 * The page guessed the trigger from the next due date; Dashboard and Equipment
 * detail had been fixed for the same case in #52, this page had not.
 * Issue: https://github.com/vtellier/OpenMaintenance/issues/67
 * Fixed in: open
 */
test('equipments card shows the hours overdue, not "today", for a task overdue by hours', async ({ page }) => {
  // Hour-meter at 1000 h. The task was never performed, so its hours baseline
  // is 0 and it was due at 500 h: overdue by 500 h. Its 24-month interval puts
  // the calendar due date about two years ahead.
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Equipments Hours Overdue Eq', tracks_hours: true, hours: 1000 },
  })
  expect(eqRes.ok()).toBeTruthy()
  const eq = await eqRes.json()

  const taskRes = await page.request.post(`${API}/tasks`, {
    data: {
      equipment_id: eq.id,
      name: 'Hours Overdue Task',
      hours_interval: 500,
      months_interval: 24,
    },
  })
  expect(taskRes.ok()).toBeTruthy()

  await page.goto('/equipments')

  const due = page
    .locator('.equipment-card')
    .filter({ hasText: 'Equipments Hours Overdue Eq' })
    .locator('.equipment-card__due')

  await expect(due).toContainText('Overdue')
  // Fixed behaviour: the hours past due, as on Dashboard and Equipment detail.
  await expect(due).toContainText('Hours Overdue Task — 500 h ago')
})
