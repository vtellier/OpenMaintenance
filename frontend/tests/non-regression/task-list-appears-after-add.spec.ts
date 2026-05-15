import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: Task list not refreshed after add — stays empty without page reload
 * Roadmap: Milestone 10 — "Task list not refreshed after add"
 * Fixed in: open
 */
test('newly added task appears in list without page reload', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Add-Task Refresh Equipment', tracks_hours: false },
  })
  const eq = await eqRes.json()

  await page.goto(`/equipments/${eq.id}`)
  await page.waitForURL(`/equipments/${eq.id}`)

  await page.getByRole('button', { name: '+ Add task' }).click()
  await page.getByPlaceholder('e.g. Oil change').fill('Post-Add Refresh Task')
  await page.getByPlaceholder('e.g. 6').fill('3')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Post-Add Refresh Task')).toBeVisible()
})
