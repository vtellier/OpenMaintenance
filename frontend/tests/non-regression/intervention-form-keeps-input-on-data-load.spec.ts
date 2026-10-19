import { expect, test } from '@playwright/test'

/**
 * Bug: the full intervention form was rebuilt, losing what the user typed,
 * when the page's data arrived while it was open, e.g. a slow first load
 * of the History page (issue #73, PR #98 review).
 * Fixed in: open
 */
test('what the user typed survives the page data arriving while the form is open', async ({ page }) => {
  // Hold the History page's task list back until the form is open and filled.
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/tasks', async route => {
    await held
    await route.continue()
  })

  await page.goto('/history')
  await page.getByRole('button', { name: '+ Log intervention' }).click()
  const comments = page.locator('.modal').getByPlaceholder('Optional notes')
  await comments.fill('Typed before the data arrived')

  release()
  await expect(page.getByText('Loading...')).toHaveCount(0)

  await expect(comments).toHaveValue('Typed before the data arrived')
})
