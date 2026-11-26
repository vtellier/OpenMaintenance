import { expect, test, type Page } from '../fixtures'

/**
 * Flow, not a bug: what the Dashboard, Equipments and History screens say
 * when there is nothing to show (the "Empty state" sections of
 * doc/gui/dashboard.md, doc/gui/equipments.md and doc/gui/history.md).
 * Issue: #150
 *
 * The run shares one database, wiped once, so earlier specs have filled it.
 * These specs answer the lists the screens load instead.
 */

const STUB_EQUIPMENT = {
  id: 990_001,
  name: 'Empty States Stub Boat',
  tracks_hours: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

/** Answers GET on the four lists the screens load; `equipments` is the only one not empty. */
async function stubLists(page: Page, equipments: unknown[] = []) {
  await page.route(/\/api\/(equipments|tasks|interventions|groups)(\?.*)?$/, route => {
    if (route.request().method() !== 'GET') return route.fallback()
    const list = new URL(route.request().url()).pathname.endsWith('/equipments') ? equipments : []
    return route.fulfill({ json: list })
  })
}

test('with no equipment, the Dashboard is all caught up and points to adding the first one', async ({ page }) => {
  await stubLists(page)

  await page.goto('/')
  await expect(page.getByText("You're all caught up. Nothing due right now.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add your first equipment' })).toHaveAttribute('href', '/equipments')
  await expect(page.locator('.hours-banner')).toHaveCount(0)
})

test('with equipments and nothing due, the Dashboard is all caught up, with no call to add one', async ({ page }) => {
  await stubLists(page, [STUB_EQUIPMENT])

  await page.goto('/')
  await expect(page.getByText("You're all caught up. Nothing due right now.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add your first equipment' })).toHaveCount(0)
})

test('with no equipment and no group, the Equipments list says so and its call opens the add form', async ({ page }) => {
  await stubLists(page)

  await page.goto('/equipments')
  await expect(page.getByText('No equipments yet.')).toBeVisible()
  await page.getByText('Add your first equipment').click()
  await expect(page.locator('.modal').getByRole('heading', { name: 'Add equipment' })).toBeVisible()
})

test('with every equipment decommissioned and no group, the Equipments list says none is in service, and Show decommissioned lists them', async ({ page }) => {
  await stubLists(page, [{ ...STUB_EQUIPMENT, commissioned_at: '2020-01-01', decommissioned_at: '2025-01-01' }])

  await page.goto('/equipments')
  await expect(page.getByText('No equipments in service.')).toBeVisible()
  await expect(page.getByText('No equipments yet.')).toHaveCount(0)
  await page.getByLabel('Show decommissioned (1)').check()
  await expect(page.locator('.equipment-card').filter({ hasText: STUB_EQUIPMENT.name })).toBeVisible()
  await expect(page.getByText('No equipments in service.')).toHaveCount(0)
})

test('with no equipment, History says nothing is logged yet and offers to log one', async ({ page }) => {
  await stubLists(page)

  await page.goto('/history')
  await expect(page.getByText('No interventions logged yet.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Log intervention' })).toBeVisible()
})

// It says "No interventions match your filters." with no filter set.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/170
test.fixme('with equipments but no intervention, History says nothing is logged yet', async ({ page }) => {
  await stubLists(page, [STUB_EQUIPMENT])

  await page.goto('/history')
  await expect(page.getByText('No interventions logged yet.', { exact: false })).toBeVisible()
  await expect(page.getByText('No interventions match your filters.')).toHaveCount(0)
})
