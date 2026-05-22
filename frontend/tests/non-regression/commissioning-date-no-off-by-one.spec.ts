import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: commissioning date displayed one day earlier than saved
 * Cause: new Date("YYYY-MM-DD") parses as UTC midnight; displaying with local-time
 *        getDate() shifts the date back by one day in negative UTC offset timezones.
 * Fixed by: using getUTCDate/getUTCMonth/getUTCFullYear in formatDate()
 */
test('commissioning date displays without off-by-one in equipment header', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Commissioning Date Test', tracks_hours: false, commissioned_at: '2003-05-01' },
  })
  const eq = await eqRes.json()

  await page.goto(`/equipments/${eq.id}`)
  await page.getByText('Commissioned 2003-05-01').waitFor()

  await expect(page.getByText('Commissioned 2003-05-01')).toBeVisible()
  await expect(page.getByText('Commissioned 2003-04-30')).not.toBeVisible()
})
