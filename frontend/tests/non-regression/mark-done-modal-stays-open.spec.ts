import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: clicking a field inside the "Mark done" modal closed the modal
 * because click events on inputs bubbled up to the modal-overlay @click handler.
 * Fixed in: (open)
 */

async function createEquipmentWithOverdueTask(page: import('@playwright/test').Page) {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Test Boat', tracks_hours: false },
  })
  const eq = await eqRes.json()

  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: 'Oil change', months_interval: 1 },
  })
  const task = await taskRes.json()

  // Log an old intervention so next_due_date is in the past (overdue)
  await page.request.post(`${API}/interventions`, {
    data: { task_id: task.id, date: '2025-01-01T00:00:00Z' },
  })

  return { eq, task }
}

test('mark-done modal stays open when clicking an input (equipment page)', async ({ page }) => {
  const { eq } = await createEquipmentWithOverdueTask(page)

  await page.goto(`/equipments/${eq.id}`)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('Mark done: Oil change')).toBeVisible()

  // Click the Notes input — should NOT close the modal
  await page.getByPlaceholder('Optional').click()
  await expect(page.getByText('Mark done: Oil change')).toBeVisible()
})

test('mark-done modal stays open when clicking an input (dashboard)', async ({ page }) => {
  await createEquipmentWithOverdueTask(page)

  await page.goto('/')
  const doneBtn = page.getByRole('button', { name: 'Done' }).first()
  await expect(doneBtn).toBeVisible()

  await doneBtn.click()
  await expect(page.getByText('Mark done: Oil change')).toBeVisible()

  // Click the Notes input — should NOT close the modal
  await page.getByPlaceholder('Optional').click()
  await expect(page.getByText('Mark done: Oil change')).toBeVisible()
})
