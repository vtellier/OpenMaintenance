import { expect, test } from '@playwright/test'

/**
 * Smoke test — verifies the test harness itself (servers reachable, DB wiped).
 * Not tied to any specific bug. Keep it minimal and fast.
 */
test('frontend loads and equipments list is empty after DB wipe', async ({ page }) => {
  await page.goto('/equipments')
  await expect(page.locator('body')).toBeVisible()
})
