import { expect, test } from '../fixtures'

/**
 * Bug: on a phone, a long backup directory runs off the screen and the page zooms out
 * Issue: #176
 * Fixed in: d4c1e1c
 *
 * A directory with no break opportunity (no hyphen, no space) stayed on one
 * line, so Settings grew wider than the phone and the browser zoomed it out;
 * the tab bar then no longer took taps. The backup list is stubbed so the
 * spec does not depend on where the backend runs.
 *
 * Runs only in the `mobile` project (playwright.config.ts).
 */

const longDirectory = '/home/maintainer/applications/openmaintenance/production/installation/current/backups'
const longFileName = 'maintenance.20260622140000averyveryverylongbackupfilenamewithnobreakopportunity.tar.gz'

test('a long backup directory wraps, and the page stays as wide as the phone', async ({ page }) => {
  await page.route('**/api/backups', route => route.fulfill({
    json: {
      enabled: true,
      path: longDirectory,
      keep: 7,
      files: [{ name: longFileName, size: 4_404_019, created_at: '2026-06-22T14:00:00Z' }],
    },
  }))

  await page.goto('/settings')
  await expect(page.getByText(`Directory: ${longDirectory}`)).toBeVisible()
  await expect(page.locator('.backup-file-item')).toHaveCount(1)

  const width = page.viewportSize()!.width
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth),
    { message: 'the page is no wider than the phone' },
  ).toBeLessThanOrEqual(width)

  const tabBar = page.locator('.navbar-mobile')
  await tabBar.getByRole('link', { name: 'Dashboard' }).tap()
  await page.waitForURL('/')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
})
