import { expect, test, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: Dashboard and Equipment detail ordered tasks by status only, so within
 * a status the order was the creation order, whatever the trigger or how far
 * past due. They now use the urgency order (doc/data-model.md, "Ranking tasks
 * by urgency"): status, then the fraction of the interval elapsed, then name.
 * Issue: https://github.com/vtellier/OpenMaintenance/issues/68
 * Fixed in: open
 */

// 13 months before today, as a YYYY-MM-DD commissioning date.
function thirteenMonthsAgo(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - 13)
  return d.toISOString().slice(0, 10)
}

async function createEquipment(page: Page, name: string): Promise<number> {
  // Hour-meter at 300 h, in service for 13 months, nothing ever performed.
  const res = await page.request.post(`${API}/equipments`, {
    data: { name, tracks_hours: true, hours: 300, commissioned_at: thirteenMonthsAgo() },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id
}

async function createTask(page: Page, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}/tasks`, { data })
  expect(res.ok()).toBeTruthy()
}

test('Dashboard and Equipment detail list tasks in urgency order', async ({ page }) => {
  // Created first, so creation order would put its block first. Its only task
  // is a month past a 12-month interval.
  const calmId = await createEquipment(page, 'Urgency Order Calm Eq')
  await createTask(page, { equipment_id: calmId, name: 'Order Calm Overdue', months_interval: 12 })

  // Created in an order unrelated to their urgency.
  const id = await createEquipment(page, 'Urgency Order Eq')
  // A month past 12 months: about 1.08 of its interval.
  await createTask(page, { equipment_id: id, name: 'Order Months Overdue', months_interval: 12 })
  // 5 h to go out of 305 h: due soon.
  await createTask(page, { equipment_id: id, name: 'Order Due Soon', hours_interval: 305 })
  // Two OK tasks at the same fraction: the name decides.
  await createTask(page, { equipment_id: id, name: 'Order OK B', months_interval: 60 })
  await createTask(page, { equipment_id: id, name: 'Order OK A', months_interval: 60 })
  // 200 h past 100 h: 3 times its interval, though its date is 11 months ahead.
  await createTask(page, { equipment_id: id, name: 'Order Hours Overdue', hours_interval: 100, months_interval: 24 })

  await page.goto('/equipments/' + id)
  await expect(page.locator('.task-row__name')).toHaveText([
    'Order Hours Overdue',
    'Order Months Overdue',
    'Order Due Soon',
    'Order OK A',
    'Order OK B',
  ])

  await page.goto('/')
  const block = page.locator('.equipment-block').filter({ hasText: 'Urgency Order Eq' })
  await expect(block.locator('.task-row__name')).toHaveText([
    'Order Hours Overdue',
    'Order Months Overdue',
    'Order Due Soon',
  ])

  // Blocks follow their most urgent task: 3 times its interval against 1.08.
  const blockNames = await page.locator('.equipment-block__name').allTextContents()
  const urgent = blockNames.findIndex(n => n.includes('Urgency Order Eq'))
  const calm = blockNames.findIndex(n => n.includes('Urgency Order Calm Eq'))
  expect(urgent).toBeGreaterThanOrEqual(0)
  expect(calm).toBeGreaterThan(urgent)
})
