import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: Interval display shows "Every 100h or Every 6mo" — redundant second "Every"
 * Roadmap: Milestone 6 — "Interval display shows 'Every 100h or Every 6mo' — remove the redundant second 'Every'"
 * Fixed in: open
 */
test('interval display does not duplicate "Every" prefix', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Test Engine', tracks_hours: true, hours: 100 },
  })
  const eq = await eqRes.json()
  await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Oil change', hours_interval: 100, months_interval: 6 },
  })

  await page.goto(`/equipments/${eq.id}`)
  const interval = page.locator('.task-row__interval')
  await expect(interval).toBeVisible()
  const text = await interval.textContent()
  expect(text).toBe('Every 100h or 6mo')
})
