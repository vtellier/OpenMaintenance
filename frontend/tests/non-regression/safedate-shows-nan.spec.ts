import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: Date formatting shows NaN everywhere on intervention dates
 * Roadmap: Milestone 6 — "Date formatting shows NaN everywhere"
 * Fixed in: open
 */
test('intervention dates display as proper YYYY-MM-DD, not NaN', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Test Engine', tracks_hours: true, hours: 100 },
  })
  const eq = await eqRes.json()
  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Oil change', hours_interval: 100 },
  })
  const task = await taskRes.json()
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2025-06-15T10:00:00Z', hours_at: 150 },
  })

  await page.goto(`/equipments/${eq.id}/history`)
  await page.getByText('2025-06-15').waitFor()

  const nanNodes = await page.evaluate(() => {
    const results = []
    const walk = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, null, false)
    let node
    while ((node = walk.nextNode())) {
      if (node.textContent && node.textContent.includes('NaN')) {
        results.push(node.textContent.substring(0, 80))
      }
    }
    return results
  })

  expect(nanNodes.length, 'NaN nodes: ' + JSON.stringify(nanNodes)).toBe(0)
})
