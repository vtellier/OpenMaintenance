import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: "Last: never" stays stale after logging an intervention — requires page reload
 * Roadmap: Milestone 10 — "Task card not updated after mark done"
 * Fixed in: open
 */
test('task last-date updates after mark done without page reload', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Mark-Done Last Date Equipment', tracks_hours: false },
  })
  const eq = await eqRes.json()

  await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Mark-Done Last Date Task', months_interval: 6 },
  })

  await page.goto(`/equipments/${eq.id}`)
  await page.waitForURL(`/equipments/${eq.id}`)

  await expect(page.getByText('Last: never')).toBeVisible()

  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Last: never')).not.toBeVisible()
})
