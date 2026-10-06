import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api'

/**
 * Bug: east of UTC, a saved calendar date displays one day early, and each
 * edit-and-save moves it back another day (issue #71).
 * Cause: the intervention date is sent as local midnight (2026-05-13 in Paris
 * becomes 2026-05-12T22:00:00Z) but read back with UTC getters. The
 * commissioning date is sent as local noon, which is already the previous UTC
 * day at UTC+13 and UTC+14.
 * Fixed in: open
 */

test.describe('in Europe/Paris (UTC+2 in May)', () => {
  test.use({ timezoneId: 'Europe/Paris' })

  test('an intervention date shows as picked on every page, before and after an edit', async ({ page }) => {
    const equipment = 'East of UTC Intervention Equipment'
    const task = 'East of UTC Intervention Task'
    const eqRes = await page.request.post(`${API}/equipments`, {
      data: { name: equipment, tracks_hours: false },
    })
    const eq = await eqRes.json()
    await page.request.post(`${API}/tasks`, {
      data: { equipment_id: eq.id, name: task, months_interval: 6 },
    })

    // Log the intervention from the global History page.
    await page.goto('/history')
    await page.getByRole('button', { name: '+ Log intervention' }).click()
    const form = page.locator('.modal')
    await form.locator('select').nth(0).selectOption({ label: equipment })
    await form.locator('select').nth(1).selectOption({ label: task })
    await form.locator('input[type="date"]').fill('2026-05-13')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(form).toBeHidden()

    const historyRow = page.locator('.history-item').filter({ hasText: task })
    await expect(historyRow.locator('.history-item__date')).toHaveText('2026-05-13')

    // Edit it from the equipment's History tab and save without changes.
    await page.goto(`/equipments/${eq.id}/history`)
    const detailRow = page.locator('.history-item').filter({ hasText: task })
    await expect(detailRow.locator('.history-item__date')).toHaveText('2026-05-13')
    await detailRow.getByRole('button', { name: 'Edit' }).click()
    await expect(form.locator('input[type="date"]')).toHaveValue('2026-05-13')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(form).toBeHidden()
    await expect(detailRow.locator('.history-item__date')).toHaveText('2026-05-13')

    // The other pages that show it agree.
    await page.goto(`/equipments/${eq.id}`)
    await expect(page.locator('.task-row').filter({ hasText: task })).toContainText('Last: 2026-05-13')
    await page.goto('/equipments')
    await expect(page.locator('.equipment-card').filter({ hasText: equipment }))
      .toContainText(`Last: ${task}, 2026-05-13`)
    await page.goto('/history')
    await expect(historyRow.locator('.history-item__date')).toHaveText('2026-05-13')
  })
})

test.describe('in Pacific/Kiritimati (UTC+14)', () => {
  test.use({ timezoneId: 'Pacific/Kiritimati' })

  test('a commissioning date shows as picked, before and after an edit', async ({ page }) => {
    const equipment = 'East of UTC Commissioning Equipment'

    await page.goto('/equipments')
    await page.getByRole('button', { name: '+ Add equipment' }).click()
    const form = page.locator('.modal')
    await form.getByPlaceholder('e.g. Main Engine').fill(equipment)
    await form.locator('input[type="date"]').fill('2024-05-01')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(form).toBeHidden()

    await page.locator('.equipment-card').filter({ hasText: equipment }).click()
    await expect(page.locator('.detail-header__meta')).toHaveText('Commissioned 2024-05-01')

    // Edit the equipment and save without changes.
    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await expect(page.locator('input[type="date"]')).toHaveValue('2024-05-01')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.detail-header__meta')).toHaveText('Commissioned 2024-05-01')
  })
})
