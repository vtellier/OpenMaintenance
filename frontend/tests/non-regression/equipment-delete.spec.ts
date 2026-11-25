import { expect, test, type Page } from '../fixtures'

const BACKEND = 'http://127.0.0.1:3001'
const API = `${BACKEND}/api`

/**
 * Flow, not a bug: deleting an equipment from its detail header
 * (doc/gui/equipments.md, "Flow: Delete an equipment").
 * Issue: #150
 */

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(`${API}${path}`, { data })
  expect(res.ok(), `POST ${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

test('Delete asks first, then removes the equipment with its tasks, history and files, and keeps its group', async ({ page }) => {
  const group = await post(page, '/groups', { name: 'Delete Eq Tenders' })
  const eq = await post(page, '/equipments', { name: 'Delete Eq Dinghy', group_id: group.id })
  const task = await post(page, '/tasks', { equipment_id: eq.id, name: 'Delete Eq Hull check', months_interval: 12 })
  await post(page, '/interventions', { task_id: task.id, date: '2026-01-15T00:00:00Z' })
  const upload = await page.request.post(`${API}/equipments/${eq.id}/files`, {
    multipart: { file: { name: 'dinghy-manual.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 manual') } },
  })
  expect(upload.ok(), await upload.text()).toBeTruthy()
  const file = await upload.json()
  expect((await page.request.get(`${BACKEND}${file.url}`)).ok()).toBeTruthy()

  await page.goto(`/equipments/${eq.id}`)
  await page.locator('.detail-header').getByRole('link', { name: 'Delete', exact: true }).click()

  await page.waitForURL(`/equipments/${eq.id}/delete`)
  await expect(page.getByRole('heading', { name: 'Delete equipment' })).toBeVisible()
  const warning = page.locator('.confirm-text')
  await expect(warning).toContainText('Delete Eq Dinghy')
  await expect(warning).toContainText('tasks and interventions')

  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  // Back on the list: the card is gone, its group stays, now empty.
  await page.waitForURL('/equipments')
  await expect(page.locator('.equipment-group').filter({ hasText: 'Delete Eq Tenders' }))
    .toContainText('No equipments in this group.')
  await expect(page.locator('.equipment-card').filter({ hasText: 'Delete Eq Dinghy' })).toHaveCount(0)

  expect((await page.request.get(`${API}/equipments/${eq.id}`)).status()).toBe(404)
  const tasks: { id: number }[] = await (await page.request.get(`${API}/tasks`)).json()
  expect(tasks.map(t => t.id)).not.toContain(task.id)
  const interventions: { task_id?: number | null }[] = await (await page.request.get(`${API}/interventions`)).json()
  expect(interventions.map(i => i.task_id)).not.toContain(task.id)
  expect((await page.request.get(`${BACKEND}${file.url}`)).status()).toBe(404)
})

test('Cancel on the delete page keeps the equipment', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Delete Eq Kept Canoe' })

  await page.goto(`/equipments/${eq.id}/delete`)
  await expect(page.getByRole('heading', { name: 'Delete equipment' })).toBeVisible()
  await page.getByRole('link', { name: 'Cancel' }).click()

  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.getByRole('heading', { name: 'Delete Eq Kept Canoe', level: 1 })).toBeVisible()
  expect((await page.request.get(`${API}/equipments/${eq.id}`)).ok()).toBeTruthy()
})

// The confirmation names the tasks and interventions, not the attached files.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/169
test.fixme('the delete confirmation warns that the attached files are deleted too', async ({ page }) => {
  const eq = await post(page, '/equipments', { name: 'Delete Eq Attachments Warning' })

  await page.goto(`/equipments/${eq.id}/delete`)
  await expect(page.locator('.confirm-text')).toContainText('Delete Eq Attachments Warning')
  await expect(page.locator('.confirm-text')).toContainText(/\bfiles\b/i)
})
