import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: Page title shows generic "Equipment #N" instead of the actual name
 * Roadmap: Milestone 6 — "Page title shows generic 'Equipment #N' instead of the actual equipment name"
 * Fixed in: open
 */
test('equipment detail page title shows the equipment name', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'My Boat Engine', tracks_hours: true, hours: 200 },
  })
  const eq = await eqRes.json()

  await page.goto(`/equipments/${eq.id}`)

  await expect(page).toHaveTitle(/My Boat Engine/)
})
