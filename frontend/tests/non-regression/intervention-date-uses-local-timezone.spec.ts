import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: "Log intervention" pre-fills the date using new Date().toISOString()
 * which returns UTC. In a timezone with a negative UTC offset (e.g. Atlantic
 * Time, UTC-3), late-evening local dates are shown as the next UTC day.
 * Fixed in: open
 */
test.use({ timezoneId: 'America/Halifax' })

test('intervention form defaults to local date in a negative-UTC-offset timezone', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Timezone Date Test Equipment', tracks_hours: false },
  })
  const eq = await eqRes.json()
  await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Timezone Date Test Task', months_interval: 1 },
  })

  // 10:09 PM ADT (UTC−3) on June 21, 2026 = 01:09 AM UTC on June 22, 2026.
  // The form must show the LOCAL date (2026-06-21), not the UTC date (2026-06-22).
  await page.clock.setFixedTime('2026-06-22T01:09:00.000Z')
  await page.goto('/history')
  await page.getByRole('button', { name: '+ Log intervention' }).click()

  await expect(page.locator('.modal input[type="date"]')).toHaveValue('2026-06-21')
})
