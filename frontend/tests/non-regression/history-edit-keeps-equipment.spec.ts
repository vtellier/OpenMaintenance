import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: editing an intervention from the global History screen loses its
 * equipment. The Task list is empty, the Hours field is hidden, and an
 * exceptional intervention cannot be saved (issue #73).
 * Fixed in: open
 */
async function seed(page: import('@playwright/test').Page, tag: string) {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: `History Edit Engine ${tag}`, icon: '🔧', tracks_hours: true, hours: 120 },
  })
  const eq = await eqRes.json()
  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: `History Edit Belt check ${tag}`, hours_interval: 100 },
  })
  const task = await taskRes.json()
  const date = new Date().toISOString()
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date, hours_at: 110 },
  })
  await page.request.post(`${API}/interventions`, {
    data: { equipment_id: eq.id, exceptional_label: `History Edit Broken impeller ${tag}`, date, hours_at: 115 },
  })
  return { eq, task }
}

test('editing a standard intervention from History shows its task and hours', async ({ page }) => {
  const { task } = await seed(page, 'A')

  await page.goto('/history')
  await page.locator('.history-item')
    .filter({ hasText: 'History Edit Belt check A' })
    .getByRole('button', { name: 'Edit' })
    .click()

  const modal = page.locator('.modal')
  const taskSelect = modal.locator('.form-field').filter({ hasText: 'Task *' }).locator('select')
  await expect(taskSelect.locator('option', { hasText: 'History Edit Belt check A' })).toHaveCount(1)
  await expect(taskSelect).toHaveValue(String(task.id))
  const hours = modal.locator('.form-field').filter({ hasText: 'Hours' }).locator('input')
  await expect(hours).toHaveValue('110')
})

test('an exceptional intervention edited from History can be saved', async ({ page }) => {
  await seed(page, 'B')

  await page.goto('/history')
  await page.locator('.history-item')
    .filter({ hasText: 'History Edit Broken impeller B' })
    .getByRole('button', { name: 'Edit' })
    .click()

  const modal = page.locator('.modal')
  await modal.getByPlaceholder('Optional notes').fill('History edit saved')
  const save = modal.getByRole('button', { name: 'Save' })
  await expect(save).toBeEnabled()
  await save.click()

  await expect(modal).toHaveCount(0)
  await expect(page.locator('.history-item').filter({ hasText: 'History Edit Broken impeller B' }))
    .toContainText('History edit saved')
})
