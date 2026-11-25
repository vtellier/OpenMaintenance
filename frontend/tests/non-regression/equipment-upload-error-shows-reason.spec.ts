import { expect, failedRequest, test } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: a refused document upload showed a generic "Failed to upload
 * document" instead of the backend's reason, so a manual over the size cap
 * gave the user no clue it was too big.
 * Issue: #119
 * Fixed in: open
 */
test("a refused document upload shows the backend's reason", async ({ page, expectErrors }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Upload Reason Inverter', tracks_hours: false },
  })
  const eq = await eqRes.json()
  expectErrors(failedRequest(`/api/equipments/${eq.id}/files`, 413))

  // Answer the upload as the backend does for a file over the cap, without
  // pushing tens of MB through the browser. Listing still hits the backend.
  await page.route(`**/api/equipments/${eq.id}/files`, route =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 413, json: { error: 'file exceeds the 50 MB limit' } })
      : route.fallback(),
  )

  await page.goto(`/equipments/${eq.id}/documents`)
  await expect(page.getByText('No documents attached.')).toBeVisible()
  await page.locator('.tab-toolbar input[type="file"]').setInputFiles({
    name: 'manual.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 stand-in for a 60 MB manual'),
  })

  await expect(page.locator('.flash--error')).toHaveText('file exceeds the 50 MB limit')
})
