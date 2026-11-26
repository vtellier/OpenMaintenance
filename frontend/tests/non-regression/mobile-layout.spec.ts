import { apiPost, expect, test } from '../fixtures'

/**
 * Flow, not a bug: what changes on a phone besides the tab bar
 * (doc/gui/equipments.md, "Layout"; doc/gui/history.md, "Responsive layout").
 * Issue: #150
 *
 * Runs only in the `mobile` project (playwright.config.ts).
 */

test('the add-equipment form fits the screen, and the new card is listed', async ({ page }) => {
  await page.goto('/equipments')
  await expect(page.getByRole('heading', { name: 'Equipments', level: 1 })).toBeVisible()
  // doc/gui/equipments.md puts the add button top-right on desktop and
  // floating on a phone. Whether a phone keeps the header button too is open
  // (#168), so this taps whichever add control shows; each opens the same form.
  const addControls = page.getByRole('button', { name: 'Add equipment', exact: true })
    .or(page.getByRole('button', { name: '+ Add equipment', exact: true }))
    .filter({ visible: true })
  await expect(addControls).not.toHaveCount(0)
  await addControls.first().tap()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Add equipment' })).toBeVisible()
  const width = page.viewportSize()!.width
  await expect.poll(async () => {
    const box = await modal.boundingBox()
    return box !== null && box.x >= 0 && box.x + box.width <= width
  }, { message: 'the form lies within the screen width' }).toBe(true)

  await modal.getByPlaceholder('e.g. Main Engine').fill('Mobile Add Canoe')
  await modal.getByRole('button', { name: 'Save', exact: true }).tap()
  await expect(modal).toBeHidden()
  await expect(page.locator('.equipment-card').filter({ hasText: 'Mobile Add Canoe' })).toBeVisible()
})

// The `.fab` rule that hides the button on wide screens comes after the
// phone-width rule that shows it, so it is hidden on phones too.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/168
test.fixme('the floating + button adds an equipment, above the tab bar', async ({ page }) => {
  await page.goto('/equipments')
  await expect(page.getByRole('heading', { name: 'Equipments', level: 1 })).toBeVisible()

  // The floating button's name: its visible text is only a "+".
  const fab = page.getByRole('button', { name: 'Add equipment', exact: true })
  await expect(fab).toBeVisible()
  const tabBar = page.locator('.navbar-mobile')
  await expect(tabBar).toBeVisible()
  await expect.poll(async () => {
    const fabBox = await fab.boundingBox()
    const tabBarBox = await tabBar.boundingBox()
    return fabBox !== null && tabBarBox !== null && fabBox.y + fabBox.height <= tabBarBox.y
  }, { message: 'the floating button sits above the tab bar' }).toBe(true)

  await fab.tap()
  const modal = page.locator('.modal')
  await modal.getByPlaceholder('e.g. Main Engine').fill('Mobile Fab Kayak')
  await modal.getByRole('button', { name: 'Save', exact: true }).tap()

  await expect(modal).toBeHidden()
  await expect(page.locator('.equipment-card').filter({ hasText: 'Mobile Fab Kayak' })).toBeVisible()
})

test('History shows each intervention as a card, its date under its task, with no table header', async ({ page }) => {
  const eq = await apiPost(page, '/equipments', { name: 'Mobile History Winch' })
  const task = await apiPost(page, '/tasks', { equipment_id: eq.id, name: 'Mobile History Grease', months_interval: 12 })
  await apiPost(page, '/interventions', { task_id: task.id, date: '2026-02-03T12:00:00Z', location: 'Mobile History Pontoon' })

  await page.goto('/history')
  const card = page.locator('.history-item').filter({ hasText: 'Mobile History Grease' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('2026-02-03')
  await expect(card).toContainText('Mobile History Pontoon')
  await expect(card.getByRole('button', { name: 'Edit' })).toBeVisible()

  await expect(page.locator('.history-header')).toBeHidden()
  const taskLine = card.getByText('Mobile History Winch / Mobile History Grease')
  const dateLine = card.getByText('2026-02-03')
  await expect.poll(async () => {
    const taskBox = await taskLine.boundingBox()
    const dateBox = await dateLine.boundingBox()
    return taskBox !== null && dateBox !== null && dateBox.y >= taskBox.y + taskBox.height
  }, { message: 'the date starts below the task line' }).toBe(true)
})
