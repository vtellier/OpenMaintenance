import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: an equipment card on the list, and the tabs of the
 * equipment detail it opens (doc/gui/equipments.md, "Card content" and
 * "Equipment detail"; doc/gui/dashboard.md, "Flow: Jump to an equipment").
 * Issue: #150
 */

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}${path}`, { data })
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

/** Yesterday, at noon UTC, so it is yesterday in every timezone the suite uses. */
function yesterday(): { iso: string; day: string } {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { iso: `${day}T12:00:00Z`, day }
}

test('a card shows its description, hour-meter, last intervention and most urgent task, and opens the Tasks tab', async ({ page }) => {
  const eq = await post(page, '/equipments', {
    name: 'Card Detail Mower', description: 'Card Detail ride-on mower', tracks_hours: true, hours: 250,
  })
  const done = await post(page, '/tasks', { equipment_id: eq.id, name: 'Card Detail Blade check', months_interval: 12 })
  // Never done, no commissioning date: overdue.
  await post(page, '/tasks', { equipment_id: eq.id, name: 'Card Detail Belt', months_interval: 12 })
  const { iso, day } = yesterday()
  await post(page, '/interventions', { task_id: done.id, date: iso })
  await post(page, '/equipments', { name: 'Card Detail Bare Trailer' })

  await page.goto('/equipments')
  const card = page.locator('.equipment-card').filter({ hasText: 'Card Detail Mower' })
  await expect(card).toContainText('Card Detail ride-on mower')
  await expect(card).toContainText('250 h')
  await expect(card).toContainText('just now')
  await expect(card).toContainText(`Last: Card Detail Blade check, ${day}`)
  await expect(card).toContainText('Overdue')
  await expect(card).toContainText('Card Detail Belt — never done')

  const bare = page.locator('.equipment-card').filter({ hasText: 'Card Detail Bare Trailer' })
  await expect(bare).toContainText('No intervention yet')
  await expect(bare).not.toContainText(' h')

  await card.click()
  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.getByRole('heading', { name: 'Card Detail Mower', level: 1 })).toBeVisible()
  await expect(page.locator('.sub-tabs').getByRole('link', { name: 'Tasks' })).toHaveClass(/(^|\s)active(\s|$)/)
  await expect(page.getByRole('heading', { name: 'Tasks', level: 2 })).toBeVisible()
  await expect(page.locator('.task-row').filter({ hasText: 'Card Detail Belt' })).toContainText('Overdue')
})

test('the History, Documents and Info tabs show the equipment\'s history, files and metadata', async ({ page }) => {
  const eq = await post(page, '/equipments', {
    name: 'Tabs Detail Generator', description: 'Tabs Detail backup power', icon: '⚡',
    tracks_hours: true, hours: 75, commissioned_at: '2024-03-10',
  })
  const task = await post(page, '/tasks', { equipment_id: eq.id, name: 'Tabs Detail Oil service', hours_interval: 100 })
  await post(page, '/interventions', { task_id: task.id, date: '2026-02-03T12:00:00Z', hours_at: 70 })

  await page.goto(`/equipments/${eq.id}`)
  const tabs = page.locator('.sub-tabs')

  await tabs.getByRole('link', { name: 'History' }).click()
  await page.waitForURL(`/equipments/${eq.id}/history`)
  await expect(tabs.getByRole('link', { name: 'History' })).toHaveClass(/(^|\s)active(\s|$)/)
  const row = page.locator('.history-item').filter({ hasText: 'Tabs Detail Oil service' })
  await expect(row).toContainText('2026-02-03')
  await expect(row).toContainText('70 h')

  await tabs.getByRole('link', { name: 'Documents' }).click()
  await page.waitForURL(`/equipments/${eq.id}/documents`)
  await expect(page.getByText('No documents attached.')).toBeVisible()
  await expect(page.getByText('+ Upload your first document')).toBeVisible()

  await tabs.getByRole('link', { name: 'Info' }).click()
  await page.waitForURL(`/equipments/${eq.id}/info`)
  const field = (label: string) => page.locator('.form-field').filter({ hasText: label })
  await expect(field('Name')).toContainText('Tabs Detail Generator')
  await expect(field('Description')).toContainText('Tabs Detail backup power')
  await expect(field('Icon')).toContainText('⚡')
  await expect(field('Date of commissioning')).toContainText('2024-03-10')
  await expect(page.locator('.toggle-row')).toContainText('Enabled')
  await expect(field('Current hours')).toContainText('75 h')
  await expect(page.getByText('Date of decommissioning')).toHaveCount(0)
})

test('the equipment name on a Dashboard block opens its Tasks tab', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Jump Dashboard Compressor' })
  await post(page, '/tasks', { equipment_id: eq.id, name: 'Jump Dashboard Drain tank', months_interval: 6 })

  await page.goto('/')
  const block = page.locator('.equipment-block').filter({ hasText: 'Jump Dashboard Compressor' })
  await block.getByRole('link', { name: 'Jump Dashboard Compressor' }).click()

  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.getByRole('heading', { name: 'Jump Dashboard Compressor', level: 1 })).toBeVisible()
  await expect(page.locator('.task-row').filter({ hasText: 'Jump Dashboard Drain tank' })).toBeVisible()
})
