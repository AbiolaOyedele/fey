import { test, expect } from '@playwright/test'

/**
 * Controls must be reachable without a hover.
 *
 * Row actions were `opacity-0 group-hover:opacity-100`. On a phone there is no
 * hover, so deleting a subtask, deleting a comment or removing an invoice line
 * was impossible — the control was there, fully invisible, and nothing said so.
 *
 * This runs on the mobile project (iPhone 13, 375px) where hover doesn't exist.
 * Asserting on computed opacity rather than on a class keeps the test honest if
 * the utility is ever renamed.
 */

test.describe('Touch reachability', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile viewport only')

  test('row actions are visible without hovering', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()

    const revealed = page.locator('.reveal-on-hover')
    const count = await revealed.count()
    test.skip(count === 0, 'no revealable controls on screen — needs a task with subtasks')

    for (let i = 0; i < Math.min(count, 5); i++) {
      const el = revealed.nth(i)
      if (!(await el.isVisible().catch(() => false))) continue
      const opacity = await el.evaluate((n) => getComputedStyle(n).opacity)
      expect(Number(opacity), 'control must not be hover-gated on touch').toBeGreaterThan(0.9)
    }
  })

  test('the page never scrolls sideways at 375px', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()

    // The board scrolls horizontally inside its own container by design; the
    // document must not.
    const overflow = await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))
    expect(overflow, 'document overflows horizontally at 375px').toBeLessThanOrEqual(1)
  })
})
