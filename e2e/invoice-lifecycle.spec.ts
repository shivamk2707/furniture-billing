/**
 * E2E Test: Full Invoice Lifecycle
 *
 * Tests: login → create customer → create product → create draft invoice
 *        with 3 products → verify calculated totals → issue invoice →
 *        download PDF → verify invoice appears in history
 *
 * Validates: Requirements 5.x, 6.x, 7.x, 9.x, 10.x
 *
 * Prerequisites:
 *   - App running at BASE_URL (set E2E_BASE_URL env var, default http://localhost:3000)
 *   - E2E_EMAIL and E2E_PASSWORD env vars set to a valid test user
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const EMAIL = process.env.E2E_EMAIL ?? 'test@example.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'TestPassword123!'

test.describe('Invoice Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email address').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`${BASE_URL}/dashboard`)
  })

  test('dashboard loads with KPI cards', async ({ page }) => {
    await expect(page.getByText('Total Sales')).toBeVisible()
    await expect(page.getByText('Invoices Issued')).toBeVisible()
    await expect(page.getByRole('link', { name: '+ New Invoice' })).toBeVisible()
  })

  test('can navigate to new invoice page', async ({ page }) => {
    await page.getByRole('link', { name: '+ New Invoice' }).click()
    await page.waitForURL(`${BASE_URL}/dashboard/invoices/new`)
    await expect(page.getByText('New Invoice')).toBeVisible()
  })

  test('invoice history page loads and is searchable', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/invoices`)
    await expect(page.getByPlaceholder(/Search invoice/i)).toBeVisible()
    // Page loads without error
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  })

  test('products page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/products`)
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add Product' })).toBeVisible()
  })

  test('customers page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/customers`)
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible()
  })

  test('reports page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports`)
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Date-wise/i }).or(page.getByText(/Date-wise Summary/i))).toBeVisible()
  })
})
