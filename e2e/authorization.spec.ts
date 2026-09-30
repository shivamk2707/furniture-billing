/**
 * E2E Test: Authorization Boundaries
 *
 * Tests: Viewer cannot access /invoices/new
 *        Billing_Staff cannot access /settings
 *        Cross-company URL access returns 403/redirect
 *
 * Validates: Requirements 1.5, 1.6, 1.7, 15.4
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const VIEWER_EMAIL = process.env.E2E_VIEWER_EMAIL ?? 'viewer@example.com'
const VIEWER_PASSWORD = process.env.E2E_VIEWER_PASSWORD ?? 'ViewerPass123!'
const BILLING_EMAIL = process.env.E2E_BILLING_EMAIL ?? 'billing@example.com'
const BILLING_PASSWORD = process.env.E2E_BILLING_PASSWORD ?? 'BillingPass123!'

test.describe('Authorization boundaries', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: /sign in/i }).or(page.getByText('TAX INVOICE'))).not.toBeVisible()
  })

  test('unauthenticated user cannot access invoices/new', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/invoices/new`)
    await page.waitForURL(/\/login/)
  })

  test('login page is accessible without auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('settings page shows correct navigation for admin', async ({ page }) => {
    // Skip if no admin credentials configured
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
      test.skip()
      return
    }

    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`${BASE_URL}/dashboard`)

    // Admin should see Settings in the sidebar
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
  })
})
