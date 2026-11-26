import { apiPost, expect, test } from '../fixtures'

/**
 * Flow, not a bug: on a phone, a bottom tab bar replaces the top navbar
 * (doc/gui/navigation.md, "Navigation pattern (responsive)").
 * Issue: #150
 *
 * Runs only in the `mobile` project (playwright.config.ts).
 */

const tabs = [
  { name: 'Dashboard', icon: '📊', path: '/' },
  { name: 'Equipments', icon: '📦', path: '/equipments' },
  { name: 'History', icon: '🕘', path: '/history' },
  { name: 'Settings', icon: '⚙️', path: '/settings' },
]

test('the tab bar replaces the top navbar, with an icon and a label for each of the four sections', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.navbar-desktop')).toBeHidden()
  const tabBar = page.locator('.navbar-mobile')
  await expect(tabBar).toBeVisible()
  await expect(tabBar.getByRole('link')).toHaveCount(tabs.length)
  for (const t of tabs) {
    const tab = tabBar.getByRole('link', { name: t.name })
    await expect(tab).toContainText(t.icon)
    await expect(tab).toContainText(t.name)
  }
})

test('tapping a tab opens its section and highlights that tab', async ({ page }) => {
  await page.goto('/')
  const tabBar = page.locator('.navbar-mobile')

  for (const t of [...tabs.slice(1), tabs[0]]) {
    await tabBar.getByRole('link', { name: t.name }).tap()
    await page.waitForURL(t.path)
    await expect(page.getByRole('heading', { name: t.name, level: 1 })).toBeVisible()
    await expect(tabBar.getByRole('link', { name: t.name })).toHaveClass(/(^|\s)active(\s|$)/)
    for (const other of tabs.filter(o => o !== t)) {
      await expect(tabBar.getByRole('link', { name: other.name })).not.toHaveClass(/(^|\s)active(\s|$)/)
    }
  }
})

test('the tab bar stays at the bottom of the screen while the page scrolls', async ({ page }) => {
  // Enough cards for the Equipments list to be taller than the screen.
  for (let i = 1; i <= 8; i++) {
    await apiPost(page, '/equipments', { name: `Mobile Tab Bar Scroll ${i}`, description: 'Long enough to need scrolling' })
  }

  await page.goto('/equipments')
  await expect(page.locator('.equipment-card').filter({ hasText: 'Mobile Tab Bar Scroll 8' })).toBeVisible()
  const tabBar = page.locator('.navbar-mobile')
  const screenHeight = page.viewportSize()!.height

  const bottomOf = async () => {
    const box = await tabBar.boundingBox()
    return box ? Math.round(box.y + box.height) : null
  }
  await expect.poll(bottomOf).toBe(screenHeight)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect.poll(bottomOf).toBe(screenHeight)
  await expect(tabBar.getByRole('link', { name: 'Settings' })).toBeInViewport()
})

test.describe('on a portrait tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  // The tab bar replaces the navbar only up to 640 px wide; a portrait tablet
  // is wider. The doc may be what changes instead (see the issue).
  // Issue: https://github.com/vtellier/OpenMaintenance/issues/174
  test.fixme('the tab bar replaces the top navbar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await expect(page.locator('.navbar-desktop')).toBeHidden()
    await expect(page.locator('.navbar-mobile')).toBeVisible()
  })
})
