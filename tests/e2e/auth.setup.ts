import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * Signs in once and saves the session for every other spec.
 *
 * The credentials come from the environment and are read straight into the
 * form — they are never written to a file, a spec, or a log. The saved session
 * lands in tests/e2e/.auth/, which is gitignored.
 *
 * Set these locally (in .env.e2e or your shell) and as repository secrets in CI:
 *   E2E_EMAIL
 *   E2E_PASSWORD
 */

const AUTH_FILE = path.join(process.cwd(), 'tests/e2e/.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  setup.skip(
    !email || !password,
    'E2E_EMAIL / E2E_PASSWORD not set — skipping the end-to-end suite.',
  )

  await page.goto('/login')

  await page.getByPlaceholder('Email address').fill(email!)
  await page.getByPlaceholder('Password').fill(password!)
  await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click()

  // Landing anywhere that isn't /login means the session took. Asserting on a
  // specific dashboard element would tie this to a page that may be redesigned.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
})
