import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Feature, not a bug: a decommissioned equipment keeps its history, and its
 * tasks are never due (doc/gui/equipments.md, doc/gui/dashboard.md,
 * doc/gui/interventions.md, ADR 0003).
 * Issue: https://github.com/vtellier/OpenMaintenance/issues/113
 */

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}${path}`, { data })
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

test('decommissioning an equipment takes it off the Dashboard and the list, and keeps it for logging past work', async ({ page }) => {
  const tenders = await post(page, '/groups', { name: 'Decom Tenders' })
  const old = await post(page, '/equipments', { name: 'Decom Old Dinghy', group_id: tenders.id, tracks_hours: true, hours: 120 })
  await post(page, '/equipments', { name: 'Decom New Dinghy', group_id: tenders.id })
  // Never done, no commissioning date: overdue while in service.
  await post(page, '/tasks', { equipment_id: old.id, name: 'Decom Hull check', months_interval: 12 })

  await page.goto('/')
  await expect(page.locator('.equipment-block').filter({ hasText: 'Decom Old Dinghy' })).toBeVisible()
  await expect(page.locator('.hours-banner')).toContainText('Decom Old Dinghy')

  // Decommission it from the edit form.
  await page.goto(`/equipments/${old.id}/edit`)
  await page.getByLabel('Decommissioned on').fill('2025-06-01')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/equipments/${old.id}$`))
  await expect(page.locator('.detail-header')).toContainText('Decommissioned')

  // The Equipments list hides it, until "Show decommissioned" shows it dimmed, in its group.
  await page.goto('/equipments')
  const section = page.locator('.equipment-group').filter({ hasText: 'Decom Tenders' })
  await expect(section.locator('.equipment-card').filter({ hasText: 'Decom New Dinghy' })).toBeVisible()
  await expect(page.locator('.equipment-card').filter({ hasText: 'Decom Old Dinghy' })).toHaveCount(0)
  await page.getByLabel(/Show decommissioned/).check()
  const dimmed = section.locator('.equipment-card--decommissioned').filter({ hasText: 'Decom Old Dinghy' })
  await expect(dimmed).toBeVisible()
  await expect(dimmed).toContainText('Decommissioned')
  await expect(dimmed).not.toContainText('Overdue')

  // Off the Dashboard: no due task, no hour-meter reminder.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.locator('.equipment-block').filter({ hasText: 'Decom Old Dinghy' })).toHaveCount(0)
  await expect(page.getByText('Decom Old Dinghy')).toHaveCount(0)

  // The intervention form still offers it, marked and after the equipments in service.
  await page.goto('/history')
  await page.getByRole('button', { name: '+ Log intervention' }).click()
  const picker = page.locator('.modal').getByLabel('Equipment', { exact: true })
  await expect(picker.getByRole('option').last()).toHaveText('Decom Old Dinghy (decommissioned)')
})
