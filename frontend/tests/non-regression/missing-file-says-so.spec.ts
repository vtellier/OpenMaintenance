import { expect, test, type Page } from '../fixtures'

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
  await expect(thumb.getByRole('img')).toHaveCount(0)

  await thumb.locator('.photo-thumb__missing').click()
  await expect(page.locator('.photo-viewer')).toHaveCount(0)

  await thumb.getByTitle('Delete photo').click()
  const confirm = page.locator('.photo-confirm')
  await expect(confirm.getByRole('img')).toHaveCount(0)
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No photos yet.')).toBeVisible()
})

/**
 * Bug: the lists reuse their rows by position. Deleting the row above shifted
 * the next file into a row built for the deleted one, which kept its old
 * Download link, image or placeholder (or showed template source text).
 * Issue: #122 (found in review)
 */

/**
 * Bug: deleting a row logged "TypeError: expressionPool[effect] is not a
 * function" from Arrow.js. Nothing on screen showed it. The shared fixture
 * (`tests/fixtures.ts`) fails these tests on any uncaught error the page
 * throws, so they also pin this one.
 * Issue: #139
 * Fixed in: 95eadbf
 */

/** A 1×1 transparent PNG, the bytes of a stubbed photo that is present. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

/**
 * Stubs a file list whose DELETE removes the entry from the next GET. A
 * listed file that is not missing is served as a tiny PNG: its bytes are not
 * on the backend, and a 404 for its <img> would fail the test as a console
 * error.
 */
async function stubFileList(page: Page, base: string, initial: ReturnType<typeof fileInfo>[]) {
  let files = initial
  await page.route(`**${base}`, route =>
    route.request().method() === 'GET' ? route.fulfill({ json: files }) : route.fallback(),
  )
  await page.route(`**${base}/*`, route => {
    const name = route.request().url().split('/').pop()
    const method = route.request().method()
    if (method === 'GET' && files.some(f => f.name === name && !f.missing)) {
      return route.fulfill({ contentType: 'image/png', body: PNG_1PX })
    }
    if (method !== 'DELETE') return route.fallback()
    files = files.filter(f => f.name !== name)
    return route.fulfill({ status: 204 })
  })
}

for (const deleteFirst of ['missing', 'present'] as const) {
  test(`deleting the ${deleteFirst} document above leaves the other row showing its own file`, async ({ page }) => {
    const eq = await (await page.request.post(`${API}/equipments`, {
      data: { name: `Row Reuse Doc ${deleteFirst}`, tracks_hours: false },
    })).json()
    const base = `/api/equipments/${eq.id}/files`
    const present = fileInfo('aaa.pdf', 'manual.pdf', `${base}/aaa.pdf`, false, 2048)
    const missing = fileInfo('bbb.pdf', 'invoice.pdf', `${base}/bbb.pdf`, true, 0)
    const [first, kept] = deleteFirst === 'missing' ? [missing, present] : [present, missing]
    await stubFileList(page, base, [first, kept])

    await page.goto(`/equipments/${eq.id}/documents`)
    await page.locator('.doc-row').filter({ hasText: first.original_name }).getByRole('button', { name: 'Delete' }).click()
    await page.locator('.modal').getByRole('button', { name: 'Delete' }).click()

    const row = page.locator('.doc-row')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(kept.original_name)
    await expect(row).not.toContainText('renderTemplate')
    if (kept.missing) {
      await expect(row.locator('.doc-row__meta')).toContainText('File missing on server')
      await expect(row.getByRole('link', { name: 'Download' })).toHaveCount(0)
    } else {
      await expect(row.locator('.doc-row__meta')).toContainText('2.0 KB')
      await expect(row.getByRole('link', { name: 'Download' })).toHaveAttribute('href', kept.url)
    }
  })

  test(`deleting the ${deleteFirst} photo before it leaves the other tile showing its own file`, async ({ page }) => {
    const label = `Row Reuse Photo ${deleteFirst} service`
    const eq = await (await page.request.post(`${API}/equipments`, {
      data: { name: `Row Reuse Photo ${deleteFirst}`, tracks_hours: false },
    })).json()
    await page.request.post(`${API}/interventions`, {
      data: { equipment_id: eq.id, exceptional_label: label, date: new Date().toISOString() },
    })
    const inv = (await (await page.request.get(`${API}/interventions`)).json())
      .find((i: { exceptional_label?: string }) => i.exceptional_label === label)
    const base = `/api/interventions/${inv.id}/files`
    const present = fileInfo('ddd.jpg', 'before.jpg', `${base}/ddd.jpg`, false, 2048)
    const missing = fileInfo('ccc.jpg', 'after.jpg', `${base}/ccc.jpg`, true, 0)
    const [first, kept] = deleteFirst === 'missing' ? [missing, present] : [present, missing]
    await stubFileList(page, base, [first, kept])

    await page.goto('/history')
    await page.locator('.history-item').filter({ hasText: label }).getByRole('button', { name: 'Edit' }).click()

    const thumbs = page.locator('.photo-thumb')
    await expect(thumbs).toHaveCount(2)
    // The confirmation shows the photo it is about, even after another one.
    await thumbs.nth(1).getByTitle('Delete photo').click()
    await page.locator('.photo-confirm').getByRole('button', { name: 'Cancel' }).click()
    await thumbs.nth(0).getByTitle('Delete photo').click()
    const confirm = page.locator('.photo-confirm')
    await expect(confirm.getByRole('img')).toHaveCount(first.missing ? 0 : 1)
    await expect(confirm.locator('.photo-confirm__preview--missing')).toHaveCount(first.missing ? 1 : 0)
    await confirm.getByRole('button', { name: 'Delete' }).click()

    await expect(thumbs).toHaveCount(1)
    await expect(thumbs).not.toContainText('renderTemplate')
    if (kept.missing) {
      await expect(thumbs).toContainText('Photo missing on server')
      await expect(thumbs.getByRole('img')).toHaveCount(0)
    } else {
      await expect(thumbs).not.toContainText('Photo missing on server')
      await expect(thumbs.getByRole('img')).toHaveAttribute('src', kept.url)
      await thumbs.getByRole('img').click()
      await expect(page.locator('.photo-viewer__img')).toHaveAttribute('src', kept.url)
    }
  })
}
