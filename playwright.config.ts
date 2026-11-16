import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke / route stubs. Point PLAYWRIGHT_BASE_URL at a running Matchflow site
 * (Docker http://localhost:8080 by default). Specs assert SPA routes exist;
 * they do not invent live SUCCESS.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
