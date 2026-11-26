import { API, apiPost, expect, test } from '../fixtures'

/**
 * Flow, not a bug: a photo added to a past intervention, opened full screen
 * and deleted, on the real backend (doc/gui/interventions.md, "Photos"); and
 * a reading lower than the equipment's (doc/gui/interventions.md,
 * "Validation rules", "Side effects on save"). Refused uploads are pinned by
 * photo-upload-error-shows-reason.spec.ts, missing photos by
 * missing-file-says-so.spec.ts.
 * Issue: #150
 */

// A 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test('a photo added to a past intervention shows in its grid and in the history, opens full screen, and is deleted after a confirmation', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Photo Flow Winch' })
  const task = await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Photo Flow Service winch', months_interval: 12 })
  await apiPost(page, '/interventions', { task_id: task.id, date: '2026-02-03T12:00:00Z' })

  await page.goto('/history')
  const row = page.locator('.history-item').filter({ hasText: 'Photo Flow Service winch' })
  await row.getByRole('button', { name: 'Edit' }).click()
  const modal = page.locator('.modal')
  await expect(modal.getByText('No photos yet.')).toBeVisible()

  await modal.getByLabel('+ Add photo', { exact: true }).setInputFiles({
    name: 'photo-flow-drum.png', mimeType: 'image/png', buffer: PNG,
  })
  const thumb = modal.getByRole('img', { name: 'photo-flow-drum.png' })
  await expect(thumb).toBeVisible()
  await expect(modal.getByText('No photos yet.')).toHaveCount(0)

  await thumb.click()
  const viewer = page.locator('.photo-viewer')
  await expect(viewer.getByRole('img', { name: 'photo-flow-drum.png' })).toBeVisible()
  // A click beside the photo closes it.
  await viewer.click({ position: { x: 5, y: 5 } })
  await expect(viewer).toHaveCount(0)

  await modal.getByRole('button', { name: 'Cancel' }).click()
  await page.reload()
  await expect(row).toContainText('1 photo')

  await row.getByRole('button', { name: 'Edit' }).click()
  await modal.getByTitle('Delete photo').click()
  const confirm = page.locator('.photo-confirm')
  await expect(confirm).toContainText('Delete this photo? This cannot be undone.')
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(modal.getByRole('img', { name: 'photo-flow-drum.png' })).toHaveCount(0)
  await expect(modal.getByText('No photos yet.')).toBeVisible()
})

test('a reading lower than the equipment\'s is saved with the intervention, and the equipment keeps its reading', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Lower Hours Engine', tracks_hours: true, hours: 200 })
  const task = await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Lower Hours Oil service', hours_interval: 100 })
  const before = await (await page.request.get(`${API}/equipments/${eq.id}`)).json()

  await page.goto(`/equipments/${eq.id}/history`)
  await page.getByRole('button', { name: '+ Log intervention' }).click()
  const modal = page.locator('.modal')
  await modal.getByLabel('Task', { exact: true }).selectOption({ label: 'Lower Hours Oil service' })
  const hours = modal.getByLabel('Hours', { exact: true })
  await expect(hours).toHaveValue('200')
  await hours.fill('150')
  const save = modal.getByRole('button', { name: 'Save' })
  await expect(save).toBeEnabled()
  await save.click()

  await expect(modal).toBeHidden()
  await expect(page.locator('.history-item').filter({ hasText: 'Lower Hours Oil service' })).toContainText('150 h')
  await expect(page.locator('.detail-header__hours')).toContainText('200 h')
  const after = await (await page.request.get(`${API}/equipments/${eq.id}`)).json()
  expect(after).toMatchObject({ hours: 200, hours_updated_at: before.hours_updated_at })
  const interventions: { hours_at?: number }[] = await (await page.request.get(`${API}/tasks/${task.id}/interventions`)).json()
  expect(interventions.map(i => i.hours_at)).toEqual([150])
})

// The form shows nothing for a lower reading.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/172
test.fixme('a reading lower than the equipment\'s shows an inline warning in the intervention form', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Lower Hours Warning Engine', tracks_hours: true, hours: 200 })
  await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Lower Hours Warning Filter', hours_interval: 100 })

  await page.goto(`/equipments/${eq.id}/history`)
  await page.getByRole('button', { name: '+ Log intervention' }).click()
  const modal = page.locator('.modal')
  await modal.getByLabel('Task', { exact: true }).selectOption({ label: 'Lower Hours Warning Filter' })
  const hours = modal.getByLabel('Hours', { exact: true })
  await expect(hours).toHaveValue('200')
  // A warning that compares the reading with the equipment's 200 h.
  const warning = modal.getByText(/\b(lower|less) than\b|\bbelow\b/i).filter({ hasText: /\b200\b/ })
  await expect(warning).toHaveCount(0)

  await hours.fill('150')
  await expect(warning).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Save' })).toBeEnabled()

  // Back to the equipment's reading, the warning goes.
  await hours.fill('200')
  await expect(warning).toHaveCount(0)
})
