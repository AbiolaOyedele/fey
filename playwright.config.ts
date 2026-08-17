import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests (TESTING.md: Playwright, critical user journeys).
 *
 * Credentials are never in this file, in the specs, or in the repo. The auth
 * setup reads E2E_EMAIL / E2E_PASSWORD from the environment and types them into
 * the real login form once; every other spec reuses the saved session. Without
 * those variables set, the suite skips rather than fails — a missing local
 * secret shouldn't look like a broken build.
 *
 * Point it at a throwaway account in a workspace you don't mind it writing to.
 * These tests create and move real tasks.
 */

const PORT = Number(process.env.E2E_PORT ?? 4010)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // Journeys touch shared server state (a task moves stage), so they run in
  // order rather than racing each other through the same workspace.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      // The bug that started all of this was a pointer bug, and the standard
      // here is mobile-first — so the journeys run at 375px too.
      name: 'mobile',
      use: { ...devices['iPhone 13'], storageState: 'tests/e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  // Starts a dev server, unless E2E_BASE_URL points at one already running (or
  // at a deployed preview). Spread rather than `webServer: undefined`, which
  // exactOptionalPropertyTypes rejects — an absent key and an undefined one are
  // different things under that flag.
  ...(process.env.E2E_BASE_URL ? {} : {
    webServer: {
      command: `npm run dev -- --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  }),
})
