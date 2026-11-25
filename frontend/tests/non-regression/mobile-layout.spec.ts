import { expect, test } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: what changes on a phone besides the tab bar
 * (doc/gui/equipments.md, "Layout"; doc/gui/history.md, "Responsive layout").
 * Issue: #150
 *
 * Runs only in the `mobile` project (playwright.config.ts).
 */

test('+ Add equipment opens a form that fits the screen, and the new card is listed', async ({ page }) => {
  await page.goto('/equipments')
  await page.getByRole('button', { name: '+ Add equipment' }).tap()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Add equipment' })).toBeVisible()
  const box = (await modal.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)

  await modal.getByPlaceholder('e.g. Main Engine').fill('Mobile Add Canoe')
  await modal.getByRole('button', { name: 'Save', exact: true }).tap()
  await expect(modal).toBeHidden()
  await expect(page.locator('.equipment-card').filter({ hasText: 'Mobile Add Canoe' })).toBeVisible()
})

// The `.fab` rule that hides the button on wide screens comes after the
// phone-width rule that shows it, so it is hidden on phones too.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/168
test.fixme('the floating + button adds an equipment, above the tab bar', async ({ page }) => {
  await page.goto('/equipments')
  await expect(page.getByRole('heading', { name: 'Equipments', level: 1 })).toBeVisible()

  const fab = page.getByRole('button', { name: '+', exact: true })
  await expect(fab).toBeVisible()
  const fabBox = (await fab.boundingBox())!
  const tabBarBox = (await page.locator('.navbar-mobile').boundingBox())!
  expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(tabBarBox.y)

  await fab.tap()
  const modal = page.locator('.modal')
  await modal.getByPlaceholder('e.g. Main Engine').fill('Mobile Fab Kayak')
  await modal.getByRole('button', { name: 'Save', exact: true }).tap()

  await expect(modal).toBeHidden()
  await expect(page.locator('.equipment-card').filter({ hasText: 'Mobile Fab Kayak' })).toBeVisible()
})

test('History shows each intervention as a card, its date under its task, with no table header', async ({ page }) => {
  const eq = await (await page.request.post(`${API}/equipments`, { data: { name: 'Mobile History Winch' } })).json()
  const task = await (await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Mobile History Grease', months_interval: 12 },
  })).json()
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2026-02-03T12:00:00Z', location: 'Mobile History Pontoon' },
  })

  await page.goto('/history')
  const card = page.locator('.history-item').filter({ hasText: 'Mobile History Grease' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('2026-02-03')
  await expect(card).toContainText('Mobile History Pontoon')
  await expect(card.getByRole('button', { name: 'Edit' })).toBeVisible()

  await expect(page.locator('.history-header')).toBeHidden()
  const taskBox = (await card.getByText('Mobile History Winch / Mobile History Grease').boundingBox())!
  const dateBox = (await card.getByText('2026-02-03').boundingBox())!
  expect(dateBox.y).toBeGreaterThanOrEqual(taskBox.y + taskBox.height)
})
