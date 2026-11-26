import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: adding an equipment with an hour-meter, and the rules of
 * the decommissioning date (doc/gui/equipments.md, "Flow: Add an equipment"
 * and "Flow: Decommission an equipment"). Decommissioning itself is pinned by
 * decommissioned-equipment.spec.ts; the group picker by equipment-groups.spec.ts.
 * Issue: #150
 */

/** A calendar day n days from today, in the browser's timezone. */
function dayFromToday(page: Page, n: number): Promise<string> {
  return page.evaluate(days => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, n)
}

test('an equipment added with an hour-meter starts with its initial reading, fresh, and the default icon', async ({ page }) => {
  await page.goto('/equipments')
  await page.getByRole('button', { name: '+ Add equipment' }).click()

  const modal = page.locator('.modal')
  const save = modal.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeDisabled()
  await modal.getByPlaceholder('e.g. Main Engine').fill('Create Flow Tender Engine')
  await expect(save).toBeEnabled()
  await modal.getByPlaceholder('Optional description').fill('Create Flow 2-stroke outboard')
  await modal.getByLabel('Date of commissioning').fill('2023-05-02')
  await expect(modal.getByLabel('Initial hours')).toHaveCount(0)
  await modal.getByRole('checkbox', { name: 'This equipment has an hour-meter' }).check()
  const hours = modal.getByLabel('Initial hours')
  await expect(hours).toHaveValue('0')
  await hours.fill('12')
  await save.click()

  await expect(modal).toBeHidden()
  const card = page.locator('.equipment-card').filter({ hasText: 'Create Flow Tender Engine' })
  await expect(card).toContainText('Create Flow 2-stroke outboard')
  await expect(card).toContainText('🔧')
  await expect(card).toContainText('12 h')
  await expect(card).toContainText('just now')

  const equipments: { id: number; name: string }[] = await (await page.request.get(`${API}/equipments`)).json()
  const created = equipments.find(e => e.name === 'Create Flow Tender Engine')!
  const saved = await (await page.request.get(`${API}/equipments/${created.id}`)).json()
  expect(saved).toMatchObject({ tracks_hours: true, hours: 12, icon: '🔧' })
  expect(saved.commissioned_at).toMatch(/^2023-05-02/)
  expect(saved.hours_updated_at).toBeTruthy()
})

test('the decommissioning date can be neither after today nor before commissioning, and clearing it puts the equipment back in service', async ({ page }) => {
  const res = await page.request.post(`${API}/equipments`, {
    data: { name: 'Decom Rules Dinghy', commissioned_at: '2024-04-01' },
  })
  const eq = await res.json()
  // Never done since commissioning more than a year ago: overdue while in service.
  await page.request.post(`${API}/tasks`, { data: { equipment_id: eq.id, name: 'Decom Rules Hull check', months_interval: 12 } })

  await page.goto(`/equipments/${eq.id}/edit`)
  const date = page.getByLabel('Decommissioned on')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(date).toHaveAttribute('max', await dayFromToday(page, 0))
  await expect(date).toHaveAttribute('min', '2024-04-01')

  await date.fill(await dayFromToday(page, 1))
  await expect(save).toBeDisabled()
  await date.fill('2024-03-31')
  await expect(save).toBeDisabled()
  await date.fill('2025-06-01')
  await expect(save).toBeEnabled()
  await save.click()
  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.detail-header')).toContainText('Decommissioned')
  await expect(page.locator('.task-row').filter({ hasText: 'Decom Rules Hull check' })).not.toContainText('Overdue')

  // Back in service: no badge, the task is due again.
  await page.goto(`/equipments/${eq.id}/edit`)
  await expect(date).toHaveValue('2025-06-01')
  await date.fill('')
  await save.click()
  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.getByRole('heading', { name: 'Decom Rules Dinghy', level: 1 })).toBeVisible()
  await expect(page.locator('.detail-header')).not.toContainText('Decommissioned')
  await expect(page.locator('.task-row').filter({ hasText: 'Decom Rules Hull check' })).toContainText('Overdue')
})
