import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: an attached file whose row exists but whose bytes are gone from the
 * server showed as "0 B" with a Download link that failed ("File wasn't
 * available on site"), and a missing photo rendered as a broken image.
 * Issue: #122
 * Fixed in: open
 *
 * The file lists are stubbed with `page.route`: the backend cannot be told to
 * lose a file from the browser. The backend side (`missing` in the list) is
 * covered by backend/tests/missing_file_test.go.
 */

function fileInfo(name: string, originalName: string, url: string, missing: boolean, size: number) {
  return { name, original_name: originalName, size, mime_type: 'application/octet-stream', uploaded_at: '2026-11-01T10:00:00Z', url, missing }
}

test('a missing document says so, has no Download link, and can be deleted', async ({ page }) => {
  const eq = await (await page.request.post(`${API}/equipments`, {
    data: { name: 'Missing Doc Watermaker', tracks_hours: false },
  })).json()
  const base = `/api/equipments/${eq.id}/files`
  const present = fileInfo('aaa.pdf', 'manual.pdf', `${base}/aaa.pdf`, false, 2048)
  const missing = fileInfo('bbb.pdf', 'invoice.pdf', `${base}/bbb.pdf`, true, 0)

  let deleted = false
  await page.route(`**${base}`, route =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: deleted ? [present] : [present, missing] })
      : route.fallback(),
  )
  await page.route(`**${base}/bbb.pdf`, route => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    deleted = true
    return route.fulfill({ status: 204 })
  })

  await page.goto(`/equipments/${eq.id}/documents`)
  const missingRow = page.locator('.doc-row').filter({ hasText: 'invoice.pdf' })
  const presentRow = page.locator('.doc-row').filter({ hasText: 'manual.pdf' })

  await expect(missingRow.locator('.doc-row__meta')).toContainText('File missing on server')
  await expect(missingRow.locator('.doc-row__meta')).not.toContainText('0 B')
  await expect(missingRow.getByRole('link', { name: 'Download' })).toHaveCount(0)
  await expect(presentRow.locator('.doc-row__meta')).toContainText('2.0 KB')
  await expect(presentRow.getByRole('link', { name: 'Download' })).toBeVisible()

  await missingRow.getByRole('button', { name: 'Delete' }).click()
  await page.locator('.modal').getByRole('button', { name: 'Delete' }).click()
  await expect(missingRow).toHaveCount(0)
  await expect(presentRow).toBeVisible()
})

test('a missing photo shows a placeholder, does not open the viewer, and can be deleted', async ({ page }) => {
  const eq = await (await page.request.post(`${API}/equipments`, {
    data: { name: 'Missing Photo Winch', tracks_hours: false },
  })).json()
  await page.request.post(`${API}/interventions`, {
    data: { equipment_id: eq.id, exceptional_label: 'Missing Photo Winch service', date: new Date().toISOString() },
  })
  const inv = (await (await page.request.get(`${API}/interventions`)).json())
    .find((i: { exceptional_label?: string }) => i.exceptional_label === 'Missing Photo Winch service')
  const base = `/api/interventions/${inv.id}/files`
  const missing = fileInfo('ccc.jpg', 'after.jpg', `${base}/ccc.jpg`, true, 0)

  let deleted = false
  await page.route(`**${base}`, route =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: deleted ? [] : [missing] })
      : route.fallback(),
  )
  await page.route(`**${base}/ccc.jpg`, route => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    deleted = true
    return route.fulfill({ status: 204 })
  })

  await page.goto('/history')
  await page.locator('.history-item')
    .filter({ hasText: 'Missing Photo Winch service' })
    .getByRole('button', { name: 'Edit' })
    .click()

  const thumb = page.locator('.photo-thumb')
  await expect(thumb).toHaveCount(1)
  await expect(thumb).toContainText('Photo missing on server')
  await expect(thumb.locator('img')).toHaveCount(0)

  await thumb.locator('.photo-thumb__missing').click()
  await expect(page.locator('.photo-viewer')).toHaveCount(0)

  await thumb.getByTitle('Delete photo').click()
  const confirm = page.locator('.photo-confirm')
  await expect(confirm.locator('img')).toHaveCount(0)
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No photos yet.')).toBeVisible()
})
