import { API, apiPost, expect, failedRequest, type Page, test } from '../fixtures'

/**
 * Flow, not a bug: renaming a group and changing its icon from its section's
 * menu (doc/gui/equipments.md, "Flow: Manage a group"). Deleting one is
 * pinned by equipment-groups.spec.ts.
 * Issue: #150
 */

function section(page: Page, groupName: string) {
  return page.locator('.equipment-group').filter({ hasText: groupName })
}

test('Rename saves the new name, and refuses a name another group has', async ({ page, expectErrors }) => {
  const group = await apiPost(page, '/groups', { name: 'Rename Group Ropes' })
  await apiPost(page, '/groups', { name: 'Rename Group Taken' })
  await apiPost(page, '/equipments', { name: 'Rename Group Halyard', group_id: group.id })

  await page.goto('/equipments')
  await section(page, 'Rename Group Ropes').getByRole('button', { name: 'Group actions' }).click()
  await section(page, 'Rename Group Ropes').getByRole('button', { name: 'Rename', exact: true }).click()

  const modal = page.locator('.modal')
  await expect(modal.getByRole('heading', { name: 'Rename group' })).toBeVisible()
  const name = modal.getByLabel('Group name')
  await expect(name).toHaveValue('Rename Group Ropes')
  const save = modal.getByRole('button', { name: 'Save' })
  await name.fill('   ')
  await expect(save).toBeDisabled()

  expectErrors(failedRequest(`/api/groups/${group.id}`, 409))
  await name.fill('rename group taken')
  await save.click()
  await expect(modal.locator('.flash--error')).toHaveText('A group with this name already exists')

  await name.fill('Rename Group Lines')
  await save.click()
  await expect(modal).toBeHidden()
  await expect(section(page, 'Rename Group Lines')).toContainText('Rename Group Halyard')
  await expect(section(page, 'Rename Group Ropes')).toHaveCount(0)
})

test('Cancel on Rename changes nothing', async ({ page }) => {
  await apiPost(page, '/groups', { name: 'Rename Group Unchanged' })

  await page.goto('/equipments')
  await section(page, 'Rename Group Unchanged').getByRole('button', { name: 'Group actions' }).click()
  await section(page, 'Rename Group Unchanged').getByRole('button', { name: 'Rename', exact: true }).click()
  const modal = page.locator('.modal')
  await modal.getByLabel('Group name').fill('Rename Group Never saved')
  await modal.getByRole('button', { name: 'Cancel' }).click()

  await expect(modal).toBeHidden()
  await expect(section(page, 'Rename Group Unchanged')).toBeVisible()
  await expect(page.getByText('Rename Group Never saved')).toHaveCount(0)
})

test('Change icon saves the icon picked at once', async ({ page }) => {
  const group = await apiPost(page, '/groups', { name: 'Rename Group Icon', icon: '⛵' })

  await page.goto('/equipments')
  await section(page, 'Rename Group Icon').getByRole('button', { name: 'Group actions' }).click()
  await section(page, 'Rename Group Icon').getByRole('button', { name: 'Change icon' }).click()
  await page.getByRole('button', { name: 'Reset to 🗂️' }).click()

  await expect(section(page, 'Rename Group Icon')).toContainText('🗂️')
  await expect.poll(async () => {
    const groups: { id: number; icon?: string }[] = await (await page.request.get(`${API}/groups`)).json()
    return groups.find(g => g.id === group.id)?.icon
  }).toBe('🗂️')
})
