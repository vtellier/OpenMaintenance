import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/** A date n days from today, YYYY-MM-DD in UTC, the day the backend counts from. */
function daysFromToday(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Feature, not a bug: expiry tasks, due on the printed expiry date of the
 * part fitted (issue #99).
 */
test('an expiry task is created with its current expiry date, then marked done with a new one', async ({ page }) => {
  const eqRes = await page.request.post(`${API}/equipments`, {
    data: { name: 'Expiry Task Life Jacket', tracks_hours: false },
  })
  const eq = await eqRes.json()

  await page.goto(`/equipments/${eq.id}`)
  await page.getByRole('button', { name: '+ Add task' }).click()

  const addModal = page.locator('.modal')
  await addModal.getByPlaceholder('e.g. Oil change').fill('Replace CO2 cartridge')
  await addModal.getByRole('radio', { name: 'Expiry date' }).check()
  await expect(addModal.getByText('Months interval')).not.toBeVisible()
  await addModal.getByLabel('Current expiry date').fill(daysFromToday(12))
  await addModal.getByRole('button', { name: 'Save' }).click()

  const row = page.locator('.task-row').filter({ hasText: 'Replace CO2 cartridge' })
  await expect(row.getByText('On expiry date')).toBeVisible()
  await expect(row.getByText('Due soon — Expires in 12 days')).toBeVisible()

  await row.getByRole('button', { name: 'Done' }).click()
  const doneForm = page.locator('.modal')
  await expect(doneForm.getByRole('button', { name: 'Save' })).toBeDisabled()
  await doneForm.getByLabel('Expiry date', { exact: true }).fill(daysFromToday(400))
  await doneForm.getByRole('button', { name: 'Save' }).click()

  await expect(row.getByText('OK', { exact: true })).toBeVisible()
  await expect(row.getByText('Last: never')).not.toBeVisible()

  // The kind is fixed, and the current expiry date is no longer asked once a
  // part has been logged.
  await row.getByRole('button', { name: 'Edit' }).click()
  const editModal = page.locator('.modal')
  await expect(editModal.getByText('Expiry task')).toBeVisible()
  await expect(editModal.getByLabel('Current expiry date')).not.toBeVisible()
})
