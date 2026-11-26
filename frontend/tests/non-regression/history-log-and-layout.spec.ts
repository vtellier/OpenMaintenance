import { apiPost, expect, test } from '../fixtures'

/**
 * Flow, not a bug: logging from the global History screen, a backdated
 * standard intervention and an exceptional one, and the History table on a
 * wide screen (doc/gui/history.md, "Flow: Backdated intervention" and
 * "Responsive layout"; doc/gui/interventions.md, "Fields", "Side effects on
 * save"). The phone layout is pinned by mobile-layout.spec.ts.
 * Issue: #150
 */

test('a backdated intervention logged from History is listed under its date, newest first', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Backdated Log Furler' })
  const task = await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Backdated Log Rinse drum', months_interval: 12 })
  await apiPost(page, '/interventions', { task_id: task.id, date: '2026-01-10T12:00:00Z' })

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

const EXCEPTIONAL_TOOLTIP = 'Exceptional interventions are one-off operations not part of your maintenance plan '
  + '(e.g. replacing a broken part). They appear in the history but do not affect task due dates.'

test('the ⓘ next to Exceptional intervention explains it on hover', async ({ page }) => {
  await page.goto('/history')
  await page.getByRole('button', { name: '+ Log intervention' }).click()
  const icon = page.locator('.modal').getByText('ⓘ', { exact: true })
  await expect(icon).toBeVisible()

  // style.css draws the tooltip after the icon, hidden until the icon is hovered.
  const tooltip = () => icon.evaluate(el => {
    const after = getComputedStyle(el, '::after')
    return { text: after.content, shown: after.opacity === '1' }
  })
  await expect.poll(tooltip).toEqual({ text: JSON.stringify(EXCEPTIONAL_TOOLTIP), shown: false })
  await icon.hover()
  await expect.poll(tooltip).toEqual({ text: JSON.stringify(EXCEPTIONAL_TOOLTIP), shown: true })
})

test('an exceptional intervention needs its label instead of a task, and leaves the task as due as before', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Exceptional Log Pump' })
  // Never done, no commissioning date: overdue.
  await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Exceptional Log Service', months_interval: 12 })

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

test('an exceptional intervention is listed like a standard one, not marked apart', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Look Alike Bilge' })
  const task = await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Look Alike Clean strainer', months_interval: 12 })
  await apiPost(page, '/interventions', { task_id: task.id, date: '2026-02-03T12:00:00Z' })
  await apiPost(page, '/interventions', {
    equipment_id: eq.id, exceptional_label: 'Look Alike Replaced float switch', date: '2026-02-04T12:00:00Z',
  })

  await page.goto('/history')
  await page.getByLabel('Equipment', { exact: true }).selectOption({ label: 'Look Alike Bilge' })
  const rows = page.locator('.history-item')
  const standard = rows.filter({ hasText: 'Look Alike Clean strainer' })
  const exceptional = rows.filter({ hasText: 'Look Alike Replaced float switch' })
  await expect(standard).toBeVisible()
  await expect(exceptional).toBeVisible()
  await expect(exceptional).toHaveAttribute('class', (await standard.getAttribute('class'))!)
  await expect(exceptional).not.toContainText(/exceptional/i)
})

test('the date range filter keeps the interventions from its first day to its last, both included', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Date Range Furnace' })
  const task = await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Date Range Sweep', months_interval: 1 })
  for (const day of ['2025-09-30', '2025-10-01', '2025-10-31', '2025-11-01']) {
    await apiPost(page, '/interventions', { task_id: task.id, date: `${day}T12:00:00Z` })
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
  const eq = await apiPost(page, '/equipments', { name: 'History Table Davit' })
  const task = await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'History Table Check falls', months_interval: 12 })
  const comment = 'History Table a long comment about the falls, the blocks, the shackles and the cleats, longer than its column'
  await apiPost(page, '/interventions', { task_id: task.id, date: '2026-02-03T12:00:00Z', comments: comment })

  await page.goto('/history')
  const header = page.locator('.history-header')
  await expect(header).toBeVisible()
  await expect(header).toContainText('Date')
  await expect(header).toContainText('Details')

  const row = page.locator('.history-item').filter({ hasText: 'History Table Check falls' })
  await expect(row.locator('.history-item__meta')).toHaveAttribute('title', new RegExp(comment))
  // One row: the date and the task share a line.
  const dateCell = row.getByText('2026-02-03')
  const taskCell = row.getByText('History Table Davit / History Table Check falls')
  await expect.poll(async () => {
    const dateBox = await dateCell.boundingBox()
    const taskBox = await taskCell.boundingBox()
    return dateBox !== null && taskBox !== null && Math.abs(dateBox.y - taskBox.y) < taskBox.height
  }, { message: 'the date and the task share a line' }).toBe(true)
})
