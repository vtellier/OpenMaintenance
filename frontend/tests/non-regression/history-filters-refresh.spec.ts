import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: History filters do not trigger a refresh of the view
 * Roadmap: Milestone 1 — "Fix dynamic refresh issues"
 * Fixed in: open
 */
test('History filters trigger a refresh of the view', async ({ page }) => {
  // Arrange — create two equipments with one intervention each
  const eq1Res = await page.request.post(`${API}/equipments`, {
    data: { name: 'Boat A', tracks_hours: false },
  })
  const eq1 = await eq1Res.json()

  const eq2Res = await page.request.post(`${API}/equipments`, {
    data: { name: 'Boat B', tracks_hours: false },
  })
  const eq2 = await eq2Res.json()

  const task1Res = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq1.id, name: 'Oil change', months_interval: 6 },
  })
  const task1 = await task1Res.json()

  const task2Res = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq2.id, name: 'Filter change', months_interval: 12 },
  })
  const task2 = await task2Res.json()

  // Log one intervention per equipment
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task1.id, date: '2026-01-15T00:00:00Z' },
  })
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task2.id, date: '2026-03-10T00:00:00Z' },
  })

  // Navigate to the history page
  await page.goto('/history')
  await page.waitForURL('/history')

  // Both interventions should be visible initially
  await expect(page.getByText('Oil change')).toBeVisible()
  await expect(page.getByText('Filter change')).toBeVisible()

  // Act — apply a filter selecting only "Boat A"
  await page.getByRole('combobox').selectOption(String(eq1.id))

  // Assert — only "Boat A" intervention should remain visible
  await expect(page.getByText('Oil change')).toBeVisible()
  await expect(page.getByText('Filter change')).not.toBeVisible()
})