import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: "Correct reading", the one way to set the reading lower
 * (doc/gui/equipments.md, "Flow: Correct the reading"). Opening it from the
 * "Keep the hour-meter reading?" question is pinned by
 * delete-intervention-asks-about-reading.spec.ts and
 * edit-intervention-asks-about-reading.spec.ts.
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

test('Correct reading from the equipment header starts empty and can set a lower reading', async ({ page }) => {
  const eq = await equipmentAt(page, 'Correct Reading Header Engine', 500)

  await page.goto(`/equipments/${eq.id}`)
  await page.locator('.detail-header').getByRole('link', { name: 'Correct reading' }).click()

  await page.waitForURL(`/equipments/${eq.id}/edit/hours/correct`)
  await expect(page.getByRole('heading', { name: 'Correct reading' })).toBeVisible()
  await expect(page.locator('.form-field').filter({ hasText: 'Current reading' })).toContainText('500 h')
  await expect(page.getByText('The reading becomes this value, even if it is lower than the current one.')).toBeVisible()

  const field = page.getByLabel('Corrected reading')
  const save = page.getByRole('button', { name: 'Correct reading' })
  await expect(field).toHaveValue('')
  await expect(save).toBeDisabled()
  await field.fill('-1')
  await expect(save).toBeDisabled()

  await field.fill('420')
  await expect(save).toBeEnabled()
  await save.click()

  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.detail-header__hours')).toContainText('420 h')
  await expect(page.locator('.detail-header__hours')).toContainText('updated just now')
  const after = await reading(page, eq.id)
  expect(after.hours).toBe(420)
  expect(Date.now() - new Date(after.hours_updated_at).getTime()).toBeLessThan(60_000)
})

test('opened with ?hours=, the field is prefilled with that reading and can be adjusted', async ({ page }) => {
  const eq = await equipmentAt(page, 'Correct Reading Prefill Engine', 500)

  await page.goto(`/equipments/${eq.id}/edit/hours/correct?hours=300`)
  const field = page.getByLabel('Corrected reading')
  await expect(field).toHaveValue('300')
  await expect(page.locator('.form-field').filter({ hasText: 'Current reading' })).toContainText('500 h')

  await field.fill('310')
  await page.getByRole('button', { name: 'Correct reading' }).click()

  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.detail-header__hours')).toContainText('310 h')
  expect((await reading(page, eq.id)).hours).toBe(310)
})

test('Cancel changes nothing, not even the freshness', async ({ page }) => {
  const eq = await equipmentAt(page, 'Correct Reading Cancel Engine', 500)
  const before = await reading(page, eq.id)

  await page.goto(`/equipments/${eq.id}/edit/hours/correct?hours=300`)
  await expect(page.getByLabel('Corrected reading')).toHaveValue('300')
  await page.getByRole('link', { name: 'Cancel' }).click()

  await page.waitForURL(`/equipments/${eq.id}`)
  await expect(page.locator('.detail-header__hours')).toContainText('500 h')
  expect(await reading(page, eq.id)).toMatchObject({ hours: 500, hours_updated_at: before.hours_updated_at })
})
