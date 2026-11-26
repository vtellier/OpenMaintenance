import { API, apiPost, expect, failedRequest, test } from '../fixtures'

/**
 * Flow, not a bug: the Group picker's options, and its inline "+ New group"
 * form, which refuses a name another group has and whose Cancel puts the
 * picker back (doc/gui/equipments.md, "The Group picker"). Creating a group from it is
 * pinned by equipment-groups.spec.ts.
 * Issue: #150
 */

test('the picker lists No group, the groups by name, then + New group', async ({ page }) => {
  await apiPost(page, '/groups', { name: 'Picker Order Zulu' })
  await apiPost(page, '/groups', { name: 'picker order alpha' })

  await page.goto('/equipments')
  await page.getByRole('button', { name: '+ Add equipment' }).click()
  const picker = page.locator('.modal').getByLabel('Group', { exact: true })
  await expect(picker).toHaveValue('')
  const options = picker.getByRole('option')
  await expect(options.filter({ hasText: 'Picker Order Zulu' })).toHaveCount(1)

  const labels = await options.allTextContents()
  expect(labels[0]).toBe('No group')
  expect(labels[labels.length - 1]).toBe('+ New group')
  // Each group is its icon, then its name; earlier specs left other groups.
  const names = labels.slice(1, -1).map(l => l.replace(/^\S+ /, ''))
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })))
  expect(names.indexOf('picker order alpha')).toBeLessThan(names.indexOf('Picker Order Zulu'))
})

test('"+ New group" refuses a name another group has, ignoring case, and creates nothing', async ({ page, expectErrors }) => {
  await apiPost(page, '/groups', { name: 'Picker Taken Masts' })

  await page.goto('/equipments')
  await page.getByRole('button', { name: '+ Add equipment' }).click()
  const modal = page.locator('.modal')
  await modal.getByLabel('Group', { exact: true }).selectOption({ label: '+ New group' })
  const newGroup = modal.locator('.group-picker__new')
  await newGroup.getByLabel('New group name').fill('picker taken MASTS')

  expectErrors(failedRequest('/api/groups', 409))
  await newGroup.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(newGroup.locator('.flash--error')).toHaveText('A group with this name already exists')
  await expect(newGroup.getByLabel('New group name')).toHaveValue('picker taken MASTS')

  const groups: { name: string }[] = await (await page.request.get(`${API}/groups`)).json()
  expect(groups.filter(g => g.name.toLowerCase() === 'picker taken masts')).toHaveLength(1)
})

// The picker shows "No group", while the form still saves the group picked
// before.
// Issue: https://github.com/vtellier/OpenMaintenance/issues/175
test.fixme('Cancel on "+ New group" puts the picker back to the group picked before', async ({ page }) => {
  const kept = await apiPost(page, '/groups', { name: 'Picker Kept Booms' })

  await page.goto('/equipments')
  await page.getByRole('button', { name: '+ Add equipment' }).click()
  const modal = page.locator('.modal')
  const picker = modal.getByLabel('Group', { exact: true })
  await picker.selectOption({ label: '🗂️ Picker Kept Booms' })
  await expect(picker).toHaveValue(String(kept.id))

  await picker.selectOption({ label: '+ New group' })
  const newGroup = modal.locator('.group-picker__new')
  await newGroup.getByLabel('New group name').fill('Picker Never created')
  // The inline form's Cancel, not the equipment form's.
  await newGroup.getByRole('button', { name: 'Cancel', exact: true }).click()

  await expect(newGroup).toHaveCount(0)
  await expect(picker).toHaveValue(String(kept.id))
  const groups: { name: string }[] = await (await page.request.get(`${API}/groups`)).json()
  expect(groups.map(g => g.name)).not.toContain('Picker Never created')
})
