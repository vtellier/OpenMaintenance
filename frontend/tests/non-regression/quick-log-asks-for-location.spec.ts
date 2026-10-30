import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: the quick log ("Done" button) had no Location field, so a location
 * could only be recorded through the full intervention form.
 * Issue: #97
 * Fixed in: open
 */
test('the Dashboard quick log records the location entered', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Quick Log Location Boat', tracks_hours: true, hours: 100 },
  })
  const eq = await eqRes.json()
  const taskName = 'Quick Log Location Task'
  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: taskName, months_interval: 1 },
  })
  const task = await taskRes.json()
  // An old intervention makes the task overdue, so the Dashboard lists it.
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2025-01-01T00:00:00Z' },
  })

  await page.goto('/')
  await page.locator('.task-row', { hasText: taskName }).getByRole('button', { name: 'Done' }).click()
  const modal = page.locator('.modal')
  await expect(modal.getByText(`Mark done: ${taskName}`)).toBeVisible()

  // Location sits between Hours and Done by, as in the full form.
  const labels = modal.locator('.form-field__label')
  await expect(labels).toHaveText(['Date *', 'Hours', 'Location', 'Done by', 'Notes'])

  await modal.locator('.form-field', { hasText: 'Location' }).locator('input').fill('  Marina Quick Log  ')
  await modal.getByRole('button', { name: 'Save' }).click()
  await expect(modal).toBeHidden()

  const res = await page.request.get(`${API}/tasks/${task.id}/interventions`)
  const interventions: { location?: string | null }[] = await res.json()
  expect(interventions.map(i => i.location ?? null)).toContain('Marina Quick Log')
})
