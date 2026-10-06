import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: the Dashboard quick log ("Done") pre-fills the date with
 * new Date().toISOString(), which is the UTC date. Whenever the local date and
 * the UTC date differ, the form shows the wrong day (issue #71; the #51 fix
 * only reached Equipment detail and History).
 * Fixed in: open
 */
test.use({ timezoneId: 'Asia/Tokyo' })

test('dashboard quick log defaults to the local date, not the UTC date', async ({ page }) => {
  const equipment = 'Dashboard Local Date Equipment'
  const task = 'Dashboard Local Date Task'
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: equipment, tracks_hours: false },
  })
  const eq = await eqRes.json()
  const taskRes = await page.request.post(`${API}/tasks`, {
    data: { equipment_id: eq.id, name: task, months_interval: 1 },
  })
  const t = await taskRes.json()
  // An old intervention makes the task overdue, so it shows on the Dashboard.
  await page.request.post(`${API}/interventions`, {
    data: { task_id: t.id, date: '2025-01-01T00:00:00Z' },
  })

  // 01:30 on 2026-06-22 in Tokyo (UTC+9) is still 2026-06-21 in UTC. The
  // instant is in the past, so the backend accepts the date on save.
  await page.clock.setFixedTime('2026-06-21T16:30:00.000Z')
  await page.goto('/')

  await page.locator('.equipment-block').filter({ hasText: equipment })
    .getByRole('button', { name: 'Done' }).click()
  const form = page.locator('.modal')
  await expect(form.locator('input[type="date"]')).toHaveValue('2026-06-22')

  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  await page.goto(`/equipments/${eq.id}/history`)
  await expect(page.locator('.history-item__date').filter({ hasText: '2026-06-22' })).toHaveCount(1)
})
