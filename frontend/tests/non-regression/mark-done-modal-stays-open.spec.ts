import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: clicking a field inside the "Mark done" modal closed the modal
 * because click events on inputs bubbled up to the modal-overlay @click handler.
 * Fixed in: (open)
 */

async function createEquipmentWithOverdueTask(
  page: import('@playwright/test').Page,
  label: string,
) {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: `Test Boat ${label}`, tracks_hours: false },
  })
  const eq = await eqRes.json()

  const taskName = `Oil change ${label}`
  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: taskName, months_interval: 1 },
  })
  const task = await taskRes.json()

  // Log an old intervention so next_due_date is in the past (overdue)
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2025-01-01T00:00:00Z' },
  })

  return { eq, task, taskName }
}

test('mark-done modal stays open when clicking an input (equipment page)', async ({ page }) => {
  const { eq, taskName } = await createEquipmentWithOverdueTask(page, 'Equipment Page')

  await page.goto(`/equipments/${eq.id}`)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText(`Mark done: ${taskName}`)).toBeVisible()

  // Click the Notes input — should NOT close the modal
  await page.getByPlaceholder('Optional').click()
  await expect(page.getByText(`Mark done: ${taskName}`)).toBeVisible()
})

test('mark-done modal stays open when clicking an input (dashboard)', async ({ page }) => {
  const { taskName } = await createEquipmentWithOverdueTask(page, 'Dashboard')

  await page.goto('/')

  // Scope to this test's own task row: the dashboard also lists overdue tasks
  // created by the other specs in the run.
  const doneBtn = page
    .locator('.task-row', { hasText: taskName })
    .getByRole('button', { name: 'Done' })
  await expect(doneBtn).toBeVisible()

  await doneBtn.click()
  await expect(page.getByText(`Mark done: ${taskName}`)).toBeVisible()

  // Click the Notes input — should NOT close the modal
  await page.getByPlaceholder('Optional').click()
  await expect(page.getByText(`Mark done: ${taskName}`)).toBeVisible()
})
