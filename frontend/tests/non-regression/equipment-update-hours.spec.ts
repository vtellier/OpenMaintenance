import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: "Update hours", from the equipment header and from the
 * Dashboard's hour-meter banner (doc/gui/equipments.md, "Flow: Update
 * hour-meter"; doc/gui/dashboard.md, "Flow: Update an hour-meter from the
 * dashboard banner"). The refused save is pinned by
 * equipment-hours-error-shows-reason.spec.ts.
 * Issue: #150
 */

async function equipmentAt(page: Page, name: string, hours: number) {
  const res = await page.request.post(`${API}/equipments`, { data: { name, tracks_hours: true, hours } })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function reading(page: Page, id: number): Promise<{ hours: number; hours_updated_at: string }> {
  return (await page.request.get(`${API}/equipments/${id}`)).json()
}

test('Update hours from the equipment header saves a higher reading and returns to the equipment', async ({ page }) => {
  const eq = await equipmentAt(page, 'Update Hours Header Engine', 100)

  await page.goto(`/equipments/${eq.id}`)
  await page.locator('.detail-header').getByRole('link', { name: 'Update hours' }).click()

  await page.waitForURL(`/equipments/${eq.id}/edit/hours`)
  await expect(page.getByRole('heading', { name: 'Update hours' })).toBeVisible()
  await expect(page.getByText('Updating hours for Update Hours Header Engine')).toBeVisible()
  await expect(page.locator('.form-field').filter({ hasText: 'Current hours' })).toContainText('100 h')
  const newHours = page.getByLabel('New hours')
  await expect(newHours).toHaveValue('100')

  await newHours.fill('140')
  await page.getByRole('button', { name: 'Update hours' }).click()

  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.detail-header__hours')).toContainText('140 h')
  await expect(page.locator('.detail-header__hours')).toContainText('updated just now')
  expect((await reading(page, eq.id)).hours).toBe(140)
})

test('a reading lower than the current one cannot be saved, and Cancel changes nothing', async ({ page }) => {
  const eq = await equipmentAt(page, 'Update Hours Lower Engine', 100)
  const before = await reading(page, eq.id)

  await page.goto(`/equipments/${eq.id}/edit/hours`)
  const newHours = page.getByLabel('New hours')
  const save = page.getByRole('button', { name: 'Update hours' })
  await newHours.fill('90')
  await expect(save).toBeDisabled()
  await newHours.fill('100')
  await expect(save).toBeEnabled()

  await page.getByRole('link', { name: 'Cancel' }).click()
  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.detail-header__hours')).toContainText('100 h')
  expect(await reading(page, eq.id)).toMatchObject({ hours: 100, hours_updated_at: before.hours_updated_at })
})

test('saving the same reading confirms it: the reading stays and is fresh again', async ({ page }) => {
  const eq = await equipmentAt(page, 'Update Hours Same Engine', 100)
  const before = await reading(page, eq.id)

  await page.goto(`/equipments/${eq.id}/edit/hours`)
  await expect(page.getByLabel('New hours')).toHaveValue('100')
  await page.getByRole('button', { name: 'Update hours' }).click()
  await page.waitForURL(`/equipments/${eq.id}`)

  const after = await reading(page, eq.id)
  expect(after.hours).toBe(100)
  expect(new Date(after.hours_updated_at).getTime()).toBeGreaterThan(new Date(before.hours_updated_at).getTime())
})

test('Update on a stale Dashboard banner row opens the hours form, and the saved reading leaves the stale list', async ({ page }) => {
  const name = 'Update Hours Banner Engine'
  const eq = await equipmentAt(page, name, 200)

  // Show the browser that first reading as 10 days old, as long as it is the
  // stored one: the reading saved below passes through unchanged.
  const staleAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  await page.route(/\/api\/equipments(\?.*)?$/, async route => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const equipments = await response.json()
    for (const e of equipments) {
      if (e.id === eq.id && e.hours_updated_at === eq.hours_updated_at) e.hours_updated_at = staleAt
    }
    await route.fulfill({ response, json: equipments })
  })

  await page.goto('/')
  const staleRow = page.locator('.hours-banner__row--stale').filter({ hasText: name })
  await expect(staleRow).toContainText('200 h')
  await expect(staleRow).toContainText('updated 10d ago')
  await staleRow.getByRole('link', { name: 'Update', exact: true }).click()

  await page.waitForURL(`/equipments/${eq.id}/edit/hours`)
  await page.getByLabel('New hours').fill('230')
  await page.getByRole('button', { name: 'Update hours' }).click()
  await page.waitForURL(`/equipments/${eq.id}`)

  await page.goto('/')
  await expect(page.locator('.hours-banner__fresh')).toContainText(name)
  await expect(staleRow).toHaveCount(0)
  expect((await reading(page, eq.id)).hours).toBe(230)
})
