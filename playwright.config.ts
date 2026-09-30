import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration.
 *
 * Run with: npm run test:e2e
 *
 * Prerequisites:
 *   1. Start the Next.js dev server: npm run dev
 *   2. Apply migrations to your Supabase project
 *   3. Set E2E_EMAIL and E2E_PASSWORD env vars
 *
 * Or use webServer to auto-start:
 *   Uncomment the webServer section below.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // Auth state is shared
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Uncomment to auto-start the dev server before running E2E tests:
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
})
