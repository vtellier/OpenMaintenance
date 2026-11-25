import { expect, test, type Page } from '../fixtures'

const API = 'http://127.0.0.1:3001/api'

/**
 * Flow, not a bug: the app shell's navigation (doc/gui/navigation.md).
 * Issue: #150
 *
 * Runs in both projects: on desktop the navigation in view is the top
 * navbar, on a phone the bottom tab bar. The other one is hidden, so the
 * spec only ever finds the one the viewport shows.
 */

const sections = [
  { name: 'Dashboard', path: '/' },
  { name: 'Equipments', path: '/equipments' },
  { name: 'History', path: '/history' },
  { name: 'Settings', path: '/settings' },
]

/** The navigation the viewport shows: the top navbar, or the tab bar. */
function appNav(page: Page) {
  return page.locator('.navbar-desktop').or(page.locator('.navbar-mobile')).filter({ visible: true })
}

/** Checks that `current` is the one highlighted section. */
async function expectHighlighted(page: Page, current: string) {
  for (const s of sections) {
    const link = appNav(page).getByRole('link', { name: s.name })
    if (s.name === current) await expect(link).toHaveClass(/(^|\s)active(\s|$)/)
    else await expect(link).not.toHaveClass(/(^|\s)active(\s|$)/)
  }
}

test('opening the app at / lands on the Dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Dashboard | OpenMaintenance')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  await expectHighlighted(page, 'Dashboard')
})

test('each section is one click away in the navigation, and is highlighted once open', async ({ page }) => {
  await page.goto('/settings')

  for (const s of sections) {
    await appNav(page).getByRole('link', { name: s.name }).click()
    await page.waitForURL(s.path)
    await expect(page.getByRole('heading', { name: s.name, level: 1 })).toBeVisible()
    await expectHighlighted(page, s.name)
  }
})

test('an equipment page highlights Equipments', async ({ page }) => {
  const eq = await (await page.request.post(`${API}/equipments`, {
    data: { name: 'Navigation Highlight Pump' },
  })).json()

  await page.goto(`/equipments/${eq.id}`)
  await expect(page.getByRole('heading', { name: 'Navigation Highlight Pump', level: 1 })).toBeVisible()
  await expectHighlighted(page, 'Equipments')
})

test('the app name in the top navbar goes to the Dashboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The tab bar has no app name: its Dashboard tab does that.')

  await page.goto('/history')
  await appNav(page).getByRole('link', { name: 'OpenMaintenance', exact: true }).click()
  await page.waitForURL('/')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
})
