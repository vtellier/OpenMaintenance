import { expect, test, type Page } from '../fixtures'

/**
 * Flow, not a bug: the Settings screen's Appearance, Backup and About
 * sections (doc/gui/settings.md). The update check is pinned by
 * manual-update-check.spec.ts and update-status-not-shown-when-check-pending.spec.ts.
 * Issue: #150
 */

/** A theme choice: the radio itself is hidden, its label is what the user clicks. */
function themeOption(page: Page, name: 'Auto' | 'Light' | 'Dark') {
  return {
    label: page.locator('.theme-option').filter({ hasText: name }),
    radio: page.getByRole('radio', { name, includeHidden: true }),
  }
}

async function expectChosen(page: Page, name: 'Auto' | 'Light' | 'Dark') {
  await expect(themeOption(page, name).radio).toBeChecked()
  await expect(themeOption(page, name).label).toHaveClass(/(^|\s)active(\s|$)/)
}

test('the theme follows the system by default, and a choice applies at once and stays after a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/settings')
  const root = page.locator(':root')

  await expectChosen(page, 'Auto')
  await expect(root).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(root).toHaveAttribute('data-theme', 'light')

  await themeOption(page, 'Dark').label.click()
  await expectChosen(page, 'Dark')
  await expect(root).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expectChosen(page, 'Dark')
  await expect(root).toHaveAttribute('data-theme', 'dark')

  await themeOption(page, 'Light').label.click()
  await expectChosen(page, 'Light')
  await expect(root).toHaveAttribute('data-theme', 'light')
})

test('the Backup section shows the configuration and the backup files, newest first', async ({ page }) => {
  await page.route('**/api/backups', route => route.fulfill({
    json: {
      enabled: true,
      path: '/data/settings-spec-backups',
      keep: 7,
      files: [
        { name: 'maintenance.20260622-140000.tar.gz', size: 4_404_019, created_at: '2026-06-22T14:00:00Z' },
        { name: 'maintenance.20260621-140000.bak', size: 1_153_434, created_at: '2026-06-21T14:00:00Z' },
      ],
    },
  }))

  await page.goto('/settings')
  await expect(page.getByText('Status: Enabled')).toBeVisible()
  await expect(page.getByText('Directory: /data/settings-spec-backups')).toBeVisible()
  await expect(page.getByText('Retention: 7 backups')).toBeVisible()
  const files = page.locator('.backup-file-item')
  await expect(files).toHaveCount(2)
  await expect(files.nth(0)).toContainText('maintenance.20260622-140000.tar.gz')
  await expect(files.nth(0)).toContainText('4.2 MB')
  await expect(files.nth(1)).toContainText('maintenance.20260621-140000.bak')
})

test('with backups disabled, the Backup section lists no files', async ({ page }) => {
  await page.route('**/api/backups', route => route.fulfill({
    json: { enabled: false, path: '/data/settings-spec-off', keep: 0, files: [] },
  }))

  await page.goto('/settings')
  await expect(page.getByText('Status: Disabled')).toBeVisible()
  await expect(page.getByText('Retention: Unlimited')).toBeVisible()
  await expect(page.getByText('No backups yet.')).toHaveCount(0)
  await expect(page.locator('.backup-file-item')).toHaveCount(0)
})

test('with backups enabled and none made yet, the Backup section says so', async ({ page }) => {
  await page.route('**/api/backups', route => route.fulfill({
    json: { enabled: true, path: '/data/settings-spec-empty', keep: 1, files: [] },
  }))

  await page.goto('/settings')
  await expect(page.getByText('Retention: 1 backup', { exact: true })).toBeVisible()
  await expect(page.getByText('No backups yet.')).toBeVisible()
})

test('the About section names the app and its version, links to the repository and states the license', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText(/^OpenMaintenance \S+$/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'github.com/vtellier/OpenMaintenance' }))
    .toHaveAttribute('href', 'https://github.com/vtellier/OpenMaintenance')
  await expect(page.getByText('MIT License')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Check for updates' })).toBeVisible()
})
