import { expect, failedRequest, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: a refused photo upload showed a generic "Failed to upload photo"
 * instead of the backend's reason, so a photo over the cap or a file that is
 * not an image gave the user no clue why it was refused.
 * Issue: #129
 * Fixed in: d4f8e9a (issue #129)
 */

/** Creates an equipment with one intervention and opens it from History. */
async function openInterventionPhotos(page: Page, name: string): Promise<number> {
  const label = `${name} service`
  const eq = await (await page.request.post(`${API}/equipments`, {
    data: { name, tracks_hours: false },
  })).json()
  await page.request.post(`${API}/interventions`, {
    data: { equipment_id: eq.id, exceptional_label: label, date: new Date().toISOString() },
  })
  const inv = (await (await page.request.get(`${API}/interventions`)).json())
    .find((i: { exceptional_label?: string }) => i.exceptional_label === label)

  await page.goto('/history')
  await page.locator('.history-item').filter({ hasText: label }).getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByText('No photos yet.')).toBeVisible()
  return inv.id
}

const photoInput = (page: Page) => page.locator('.photo-section input[type="file"]')

test("a file that is not an image shows the backend's reason", async ({ page, expectErrors }) => {
  const id = await openInterventionPhotos(page, 'Photo Reason Bilge Pump')
  expectErrors(failedRequest(`/api/interventions/${id}/files`, 415))

  // The real backend sniffs the bytes and answers 415.
  await photoInput(page).setInputFiles({
    name: 'notes.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('plain text, not an image'),
  })

  await expect(page.locator('.photo-section .flash--error'))
    .toHaveText('only JPEG, PNG, WebP and GIF images are allowed')
  await expect(page.getByText('No photos yet.')).toBeVisible()
})

test("a photo over the size cap shows the backend's reason", async ({ page, expectErrors }) => {
  const id = await openInterventionPhotos(page, 'Photo Reason Windlass')
  expectErrors(failedRequest(`/api/interventions/${id}/files`, 413))

  // Answer the upload as the backend does for a photo over the cap, without
  // pushing more than 10 MB through the browser. Listing still hits the backend.
  await page.route(`**/api/interventions/${id}/files`, route =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 413, json: { error: 'file exceeds the 10 MB limit' } })
      : route.fallback(),
  )

  await photoInput(page).setInputFiles({
    name: 'deck.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('stand-in for a 12 MB photo'),
  })

  await expect(page.locator('.photo-section .flash--error')).toHaveText('file exceeds the 10 MB limit')
})

test('a refused upload with no reason falls back to the generic message', async ({ page, expectErrors }) => {
  const id = await openInterventionPhotos(page, 'Photo Reason Anchor Light')
  expectErrors(failedRequest(`/api/interventions/${id}/files`, 502))

  await page.route(`**/api/interventions/${id}/files`, route =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 502, body: 'Bad Gateway' })
      : route.fallback(),
  )

  await photoInput(page).setInputFiles({
    name: 'mast.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('stand-in for a photo'),
  })

  await expect(page.locator('.photo-section .flash--error')).toHaveText('Failed to upload photo')
})
