import { API, apiPost, expect, test } from '../fixtures'

/**
 * Flow, not a bug: uploading, downloading and deleting a document on the
 * real backend (doc/gui/equipments.md, "Documents tab", "Flow: Upload a
 * document", "Flow: Delete a document"). A refused upload is pinned by
 * equipment-upload-error-shows-reason.spec.ts, a missing file by
 * missing-file-says-so.spec.ts.
 * Issue: #150
 */

test('a document uploads into the list, downloads, and is deleted after a confirmation', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Docs Flow Watermaker' })
  const content = '%PDF-1.4 Docs Flow manual'

  await page.goto(`/equipments/${eq.id}/documents`)
  await expect(page.getByText('No documents attached.')).toBeVisible()
  await page.getByLabel('+ Upload document', { exact: true }).setInputFiles({
    name: 'docs-flow-manual.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(content),
  })

  const row = page.locator('.doc-row').filter({ hasText: 'docs-flow-manual.pdf' })
  await expect(row).toBeVisible()
  await expect(row.locator('.doc-row__meta')).toContainText(`${content.length} B`)
  await expect(page.getByText('No documents attached.')).toHaveCount(0)

  const download = page.waitForEvent('download')
  await row.getByRole('link', { name: 'Download' }).click()
  expect((await download).suggestedFilename()).toBe('docs-flow-manual.pdf')

  await row.getByRole('button', { name: 'Delete' }).click()
  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Delete file' })).toBeVisible()
  await expect(modal).toContainText('docs-flow-manual.pdf')
  await modal.getByRole('button', { name: 'Delete' }).click()

  await expect(row).toHaveCount(0)
  await expect(page.getByText('No documents attached.')).toBeVisible()
  const files = await (await page.request.get(`${API}/equipments/${eq.id}/files`)).json()
  expect(files).toEqual([])
})
