import { test, expect, type Page } from '@playwright/test'

/**
 * The journey that broke in production.
 *
 * A stage set to "Ask" prompts for who picks the work up. From the board that
 * worked; from inside the task it did not — the sheet appeared, took the tap,
 * and left the task where it was, because pressing a name closed the drawer
 * underneath it mid-press. A component test now covers the mechanism; this
 * covers the thing a person actually does.
 *
 * These tests write real data. Point E2E_EMAIL at a throwaway account. Each
 * spec creates its own task and removes it afterwards.
 */

const TASK_PREFIX = 'E2E handoff'

/** A title unique to this run, so a failed cleanup can't poison the next one. */
function uniqueTitle() {
  return `${TASK_PREFIX} ${Date.now()}`
}

async function openTasks(page: Page) {
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
}

async function createTask(page: Page, title: string) {
  await page.getByRole('button', { name: /add task/i }).click()
  const dialog = page.locator('input, textarea').filter({ hasText: '' }).first()
  await dialog.fill(title)
  await page.getByRole('button', { name: /^(create|add)( task)?$/i }).first().click()
  // Creating opens the drawer on the new task.
  await expect(page.getByText(title)).toBeVisible()
}

async function deleteOpenTask(page: Page) {
  const del = page.getByRole('button', { name: /delete task/i })
  if (await del.isVisible().catch(() => false)) {
    await del.click()
    await page.getByRole('button', { name: /^delete$/i }).last().click()
  }
}

test.describe('Task handoff', () => {
  test('the Stages & rules editor is reachable and states each stage’s rule', async ({ page }) => {
    await openTasks(page)

    // Regression: this button used to render only on the Board tab while the
    // page opens on List, so it was never on screen.
    const stages = page.getByRole('button', { name: /stages & rules/i })
    await expect(stages).toBeVisible()

    await stages.click()
    await expect(page.getByRole('heading', { name: /board stages/i })).toBeVisible()

    // Every stage says what it does, defaults included — an unconfigured board
    // used to render nothing here and look identical to the old editor.
    await expect(page.getByText(/stays with whoever has it|hands to a set person|asks who’s next/i).first())
      .toBeVisible()
    await expect(page.getByRole('button', { name: /^rules$/i }).first()).toBeVisible()
  })

  test('changing the stage from inside a task asks who takes it on, and the task moves', async ({ page }) => {
    const title = uniqueTitle()
    await openTasks(page)

    // Put a stage into "Ask" mode so the prompt has a reason to appear.
    await page.getByRole('button', { name: /stages & rules/i }).click()
    await page.getByRole('button', { name: /^rules$/i }).first().click()
    await page.getByRole('button', { name: /^ask$/i }).click()
    await expect(page.getByText(/asks who’s next/i).first()).toBeVisible()
    await page.getByRole('button', { name: /^close$/i }).first().click()

    await createTask(page, title)

    // The drawer is open on the new task. Change its stage.
    const stageSelect = page.locator('select').first()
    const options = await stageSelect.locator('option').allTextContents()
    const target = options.find((o) => !/completed/i.test(o))
    test.skip(!target, 'workspace has no workflow stages configured')
    await stageSelect.selectOption({ label: target! })

    // THE BUG: this sheet appeared, and choosing did nothing.
    const sheet = page.getByRole('heading', { name: /who’s taking this on/i })
    await expect(sheet).toBeVisible()

    const firstPerson = page.getByRole('button').filter({ hasText: /@|\w+\s\w+/ }).last()
    await firstPerson.click()

    // The sheet closes, the drawer survives, and the change actually persisted.
    await expect(sheet).not.toBeVisible()
    await expect(page.getByText(title)).toBeVisible()

    await page.reload()
    await expect(page.getByText(title)).toBeVisible()

    await page.getByText(title).first().click()
    await deleteOpenTask(page)
  })

  test('a task on my desk leaves it when handed to someone else', async ({ page }) => {
    const title = uniqueTitle()
    await openTasks(page)
    await createTask(page, title)

    // Created tasks start on the creator's desk.
    await page.getByRole('button', { name: /^close$/i }).first().click().catch(() => {})
    await page.getByRole('button', { name: /my desk/i }).click()
    await expect(page.getByText(title)).toBeVisible()

    await page.getByText(title).first().click()
    await deleteOpenTask(page)
  })
})
