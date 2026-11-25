import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: logging from the global History screen, a backdated
 * standard intervention and an exceptional one, and the History table on a
 * wide screen (doc/gui/history.md, "Flow: Backdated intervention" and
 * "Responsive layout"; doc/gui/interventions.md, "Fields", "Side effects on
 * save"). The phone layout is pinned by mobile-layout.spec.ts.
 * Issue: #150
 */

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}${path}`, { data })
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

test('a backdated intervention logged from History is listed under its date, newest first', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Backdated Log Furler' })
  const task = await post(page, '/tasks', { equipment_id: eq.id, name: 'Backdated Log Rinse drum', months_interval: 12 })
  await post(page, '/interventions', { task_id: task.id, date: '2026-01-10T12:00:00Z' })

  await page.goto('/history')
  await page.getByRole('button', { name: '+ Log intervention' }).click()
  const modal = page.locator('.modal')
  await modal.getByLabel('Equipment', { exact: true }).selectOption({ label: 'Backdated Log Furler' })
  await modal.getByLabel('Task', { exact: true }).selectOption({ label: 'Backdated Log Rinse drum' })
  await modal.getByLabel('Date', { exact: true }).fill('2025-03-14')
  await modal.getByPlaceholder('e.g. Self, Garage du Port').fill('Backdated Log Rigger')
  await modal.getByRole('button', { name: 'Save' }).click()
  await expect(modal).toBeHidden()

  await page.getByLabel('Equipment', { exact: true }).selectOption({ label: 'Backdated Log Furler' })
  const rows = page.locator('.history-item')
  await expect(rows.locator('.history-item__date')).toHaveText(['2026-01-10', '2025-03-14'])
  await expect(rows.filter({ hasText: '2025-03-14' })).toContainText('Backdated Log Rigger')
})

test('an exceptional intervention needs its label instead of a task, and leaves the task as due as before', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Exceptional Log Pump' })
  // Never done, no commissioning date: overdue.
  await post(page, '/tasks', { equipment_id: eq.id, name: 'Exceptional Log Service', months_interval: 12 })

  await page.goto('/history')
  await page.getByRole('button', { name: '+ Log intervention' }).click()
  const modal = page.locator('.modal')
  await modal.getByLabel('Equipment', { exact: true }).selectOption({ label: 'Exceptional Log Pump' })
  await modal.getByLabel('Exceptional intervention').check()
  await expect(modal.getByLabel('Task', { exact: true })).toBeDisabled()
  const save = modal.getByRole('button', { name: 'Save' })
  await expect(save).toBeDisabled()
  await modal.getByPlaceholder('e.g. Replaced broken impeller').fill('Exceptional Log Replaced cracked housing')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(modal).toBeHidden()

  await expect(page.locator('.history-item').filter({ hasText: 'Exceptional Log Replaced cracked housing' }))
    .toContainText('Exceptional Log Pump')

  await page.goto(`/equipments/${eq.id}`)
  const row = page.locator('.task-row').filter({ hasText: 'Exceptional Log Service' })
  await expect(row).toContainText('Overdue')
  await expect(row).toContainText('Last: never')
})

test('the date range filter keeps the interventions from its first day to its last, both included', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Date Range Furnace' })
  const task = await post(page, '/tasks', { equipment_id: eq.id, name: 'Date Range Sweep', months_interval: 1 })
  for (const day of ['2025-09-30', '2025-10-01', '2025-10-31', '2025-11-01']) {
    await post(page, '/interventions', { task_id: task.id, date: `${day}T12:00:00Z` })
  }

  await page.goto('/history')
  await page.getByLabel('Equipment', { exact: true }).selectOption({ label: 'Date Range Furnace' })
  const dates = page.locator('.history-item').locator('.history-item__date')
  await expect(dates).toHaveText(['2025-11-01', '2025-10-31', '2025-10-01', '2025-09-30'])

  await page.getByPlaceholder('From').fill('2025-10-01')
  await expect(dates).toHaveText(['2025-11-01', '2025-10-31', '2025-10-01'])
  await page.getByPlaceholder('To').fill('2025-10-31')
  await expect(dates).toHaveText(['2025-10-31', '2025-10-01'])
})

test('on a wide screen, History is a table with a header row, and a long detail is in full on hover', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'History Table Davit' })
  const task = await post(page, '/tasks', { equipment_id: eq.id, name: 'History Table Check falls', months_interval: 12 })
  const comment = 'History Table a long comment about the falls, the blocks, the shackles and the cleats, longer than its column'
  await post(page, '/interventions', { task_id: task.id, date: '2026-02-03T12:00:00Z', comments: comment })

  await page.goto('/history')
  const header = page.locator('.history-header')
  await expect(header).toBeVisible()
  await expect(header).toContainText('Date')
  await expect(header).toContainText('Details')

  const row = page.locator('.history-item').filter({ hasText: 'History Table Check falls' })
  await expect(row.locator('.history-item__meta')).toHaveAttribute('title', new RegExp(comment))
  // One row: the date, task and details share a line.
  const dateBox = (await row.getByText('2026-02-03').boundingBox())!
  const taskBox = (await row.getByText('History Table Davit / History Table Check falls').boundingBox())!
  expect(Math.abs(dateBox.y - taskBox.y)).toBeLessThan(taskBox.height)
})
