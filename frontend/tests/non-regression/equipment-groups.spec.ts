import { API, apiPost, expect, type Page, test } from '../fixtures'

/**
 * Feature, not a bug: equipment groups organise the Equipments list
 * (doc/gui/equipments.md, doc/gui/history.md, ADR 0002).
 * Issue: https://github.com/vtellier/OpenMaintenance/issues/112
 */

function section(page: Page, groupName: string) {
  return page.locator('.equipment-group').filter({ hasText: groupName })
}

test('a group created from the equipment form shows its equipments, its worst status, and stays collapsed after a reload', async ({ page }) => {
  await page.goto('/equipments')
  await page.getByRole('button', { name: '+ Add equipment' }).click()
  await page.getByPlaceholder('e.g. Main Engine').fill('Groups Port Winch')
  await page.getByLabel('Group', { exact: true }).selectOption({ label: '+ New group' })
  await page.getByLabel('New group name').fill('Groups Winches')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByLabel('Group', { exact: true })).toHaveValue(/^\d+$/)
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  const winches = section(page, 'Groups Winches')
  const header = winches.getByRole('button', { name: /Groups Winches/ })
  await expect(header).toContainText('1')
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  await expect(winches.locator('.equipment-card').filter({ hasText: 'Groups Port Winch' })).toBeVisible()

  await header.click()
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Groups Port Winch')).toBeHidden()

  // An overdue task (never done, no commissioning date) shows on the
  // collapsed header: a collapsed group never hides an overdue equipment.
  const equipments = await (await page.request.get(`${API}/equipments`)).json()
  const portWinch = equipments.find((eq: { name: string }) => eq.name === 'Groups Port Winch')
  await apiPost(page, '/tasks', { equipment_id: portWinch.id, name: 'Groups Grease winch', months_interval: 12 })

  await page.reload()
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Groups Port Winch')).toBeHidden()
  await expect(header).toContainText('Overdue')
})

test('deleting a group keeps its equipments, now ungrouped', async ({ page }) => {
  const sails = await apiPost(page, '/groups', { name: 'Groups Sails' })
  await apiPost(page, '/equipments', { name: 'Groups Genoa', group_id: sails.id })

  await page.goto('/equipments')
  await section(page, 'Groups Sails').getByRole('button', { name: 'Group actions' }).click()
  await section(page, 'Groups Sails').getByRole('button', { name: 'Delete' }).click()
  const confirm = page.locator('.modal')
  await expect(confirm).toContainText('Delete the group "Groups Sails"? Its 1 equipment is kept and no longer belongs to a group.')
  await confirm.getByRole('button', { name: 'Delete' }).click()

  await expect(section(page, 'Groups Sails')).toHaveCount(0)
  const genoa = page.locator('.equipment-card').filter({ hasText: 'Groups Genoa' })
  await expect(genoa).toBeVisible()
  await expect(page.locator('.equipment-group').locator('.equipment-card').filter({ hasText: 'Groups Genoa' })).toHaveCount(0)
})

test('changing the icon from the equipment header keeps its group', async ({ page }) => {
  const safety = await apiPost(page, '/groups', { name: 'Groups Safety' })
  const jacket = await apiPost(page, '/equipments', { name: 'Groups Life Jacket', icon: '⛵', group_id: safety.id })

  await page.goto(`/equipments/${jacket.id}`)
  await page.getByTitle('Change icon').click()
  await page.getByRole('button', { name: 'Reset to 🔧' }).click()

  await expect.poll(async () => {
    const eq = await (await page.request.get(`${API}/equipments/${jacket.id}`)).json()
    return { icon: eq.icon, group: eq.group_id }
  }).toEqual({ icon: '🔧', group: safety.id })
})

test('the History filter shows the interventions of every equipment of a group', async ({ page }) => {
  const deck = await apiPost(page, '/groups', { name: 'Groups Deck' })
  const windlass = await apiPost(page, '/equipments', { name: 'Groups Windlass', group_id: deck.id })
  const cleat = await apiPost(page, '/equipments', { name: 'Groups Cleat', group_id: deck.id })
  const engine = await apiPost(page, '/equipments', { name: 'Groups Engine' })
  for (const [eq, task] of [[windlass, 'Groups Service windlass'], [cleat, 'Groups Check cleat'], [engine, 'Groups Engine service']]) {
    const t = await apiPost(page, '/tasks', { equipment_id: eq.id, name: task, months_interval: 12 })
    await apiPost(page, '/interventions', { task_id: t.id, date: '2026-01-15T00:00:00Z' })
  }

  await page.goto('/history')
  await page.getByLabel('Equipment', { exact: true }).selectOption({ label: '🗂️ Groups Deck' })

  const rows = page.locator('.history-item')
  await expect(rows.filter({ hasText: 'Groups Service windlass' })).toBeVisible()
  await expect(rows.filter({ hasText: 'Groups Check cleat' })).toBeVisible()
  await expect(rows.filter({ hasText: 'Groups Engine service' })).toHaveCount(0)
})

test('a group created from the form, then the form cancelled, shows as an empty section and keeps the list whole', async ({ page }) => {
  await apiPost(page, '/equipments', { name: 'Groups Anchor' })
  await apiPost(page, '/equipments', { name: 'Groups Zinc anode' })

  await page.goto('/equipments')
  await expect(page.locator('.equipment-card').filter({ hasText: 'Groups Zinc anode' })).toHaveCount(1)
  await page.getByRole('button', { name: '+ Add equipment' }).click()
  await page.getByLabel('Group', { exact: true }).selectOption({ label: '+ New group' })
  await page.getByLabel('New group name').fill('Groups Mooring')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByLabel('Group', { exact: true })).toHaveValue(/^\d+$/)
  await page.locator('.modal').getByRole('button', { name: 'Cancel', exact: true }).click()

  await expect(section(page, 'Groups Mooring')).toContainText('No equipments in this group.')
  // The cards around the new section are listed once each.
  await expect(page.locator('.equipment-card').filter({ hasText: 'Groups Anchor' })).toHaveCount(1)
  await expect(page.locator('.equipment-card').filter({ hasText: 'Groups Zinc anode' })).toHaveCount(1)
})
