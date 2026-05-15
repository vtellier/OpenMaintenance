import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: New intervention not shown in per-equipment History tab without page reload
 * Roadmap: Milestone 10 (same root cause as task list refresh)
 * Fixed in: open
 */
test('new intervention appears in equipment history tab without page reload', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'History Refresh Equipment', tracks_hours: false },
  })
  const eq = await eqRes.json()

  await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'History Refresh Task', months_interval: 6 },
  })

  await page.goto(`/equipments/${eq.id}/history`)
  await page.waitForURL(`/equipments/${eq.id}/history`)

  await expect(page.getByText('No history yet for this equipment.')).toBeVisible()

  await page.getByRole('button', { name: '+ Log intervention' }).click()
  await page.locator('select').selectOption({ label: 'History Refresh Task' })
  await page.locator('input[type="date"]').fill('2026-01-15')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('No history yet for this equipment.')).not.toBeVisible()
  await expect(page.getByText('History Refresh Task')).toBeVisible()
})
