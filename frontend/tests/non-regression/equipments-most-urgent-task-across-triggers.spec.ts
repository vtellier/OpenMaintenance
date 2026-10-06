import { expect, test, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: on the Equipments page, the status summary of an equipment with several
 * overdue tasks picks the wrong most urgent one when they are overdue by
 * different triggers. A task overdue by hours ranked least overdue when its
 * calendar due date was still in the future, and hours past due were compared
 * as if they were clock hours.
 * Issue: https://github.com/vtellier/OpenMaintenance/issues/68
 * Fixed in: open
 */

// 13 months before today, as a YYYY-MM-DD commissioning date.
function thirteenMonthsAgo(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - 13)
  return d.toISOString().slice(0, 10)
}

async function createEquipment(page: Page, name: string) {
  // Hour-meter at 300 h, in service for 13 months, nothing ever performed.
  const res = await page.request.post(`${API}/equipments`, {
    data: { name, tracks_hours: true, hours: 300, commissioned_at: thirteenMonthsAgo() },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function createTask(page: Page, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}/tasks`, { data })
  expect(res.ok()).toBeTruthy()
}

function dueSummary(page: Page, equipmentName: string) {
  return page
    .locator('.equipment-card')
    .filter({ hasText: equipmentName })
    .locator('.equipment-card__due')
}

test('a task overdue by hours with a future calendar date can be the most urgent', async ({ page }) => {
  const eq = await createEquipment(page, 'Urgency Future Date Eq')

  // Every 100 h, never done: due at 100 h, overdue by 200 h, three times its
  // interval. Its 24-month interval puts the calendar due date 11 months ahead.
  await createTask(page, { equipment_id: eq.id, name: 'Future Date Hours Task', hours_interval: 100, months_interval: 24 })
  // Every 12 months, due a month ago: overdue by about a twelfth of its interval.
  await createTask(page, { equipment_id: eq.id, name: 'Future Date Months Task', months_interval: 12 })

  await page.goto('/equipments')

  const due = dueSummary(page, 'Urgency Future Date Eq')
  await expect(due).toContainText('Overdue')
  await expect(due).toContainText('2 tasks')
  // The hours task is the most urgent: its timing text is the one shown.
  await expect(due).toContainText('200 h ago')
})

test('hours past due are not compared as clock hours', async ({ page }) => {
  const eq = await createEquipment(page, 'Urgency Clock Hours Eq')

  // Hours only: overdue by 200 h, three times its 100 h interval.
  await createTask(page, { equipment_id: eq.id, name: 'Clock Hours Hours Task', hours_interval: 100 })
  // Overdue by about a month (more than 200 clock hours), a twelfth of its
  // 12-month interval.
  await createTask(page, { equipment_id: eq.id, name: 'Clock Hours Months Task', months_interval: 12 })

  await page.goto('/equipments')

  const due = dueSummary(page, 'Urgency Clock Hours Eq')
  await expect(due).toContainText('Overdue')
  await expect(due).toContainText('2 tasks')
  await expect(due).toContainText('200 h ago')
})
