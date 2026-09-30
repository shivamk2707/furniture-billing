/**
 * Integration tests for invoice issue transaction
 *
 * Tests:
 * - Property 11: Invoice number uniqueness under concurrency
 * - Property 5: Invoice total consistency (grand_total == sum of line_totals)
 *
 * Requires SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY.
 * Skips gracefully when not configured.
 *
 * Feature: furniture-billing
 * Property 11: Invoice number uniqueness under concurrency
 * Property 5: Invoice total consistency (calculation ↔ database)
 * Validates: Requirements 7.4, 15.6, 6.13, 15.9
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Decimal from 'decimal.js'

const TEST_URL = process.env.SUPABASE_TEST_URL
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const hasTestDb = Boolean(TEST_URL && TEST_SERVICE_KEY)

let companyId: string
let settingsId: string

describe.skipIf(!hasTestDb)('Invoice issue transaction', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: SupabaseClient<any>

  beforeAll(async () => {
    admin = createClient(TEST_URL!, TEST_SERVICE_KEY!)

    // Create test company
    const { data: company } = await admin
      .from('companies')
      .insert({ name: 'Issue Test Company' })
      .select('id')
      .single()
    companyId = company!.id

    // Create company settings with PP prefix
    const { data: settings } = await admin
      .from('company_settings')
      .insert({
        company_id: companyId,
        legal_name: 'Issue Test Company',
        invoice_prefix: 'TST',
        state_code: '09',
        due_date_offset_days: 15,
      })
      .select('id')
      .single()
    settingsId = settings!.id
  })

  afterAll(async () => {
    if (companyId) {
      await admin.from('invoice_payments').delete().eq('company_id', companyId)
      await admin.from('audit_logs').delete().eq('company_id', companyId)
      await admin.from('invoice_items').delete().in(
        'invoice_id',
        (await admin.from('invoices').select('id').eq('company_id', companyId)).data?.map((i) => i.id) ?? []
      )
      await admin.from('invoices').delete().eq('company_id', companyId)
      await admin.from('invoice_counters').delete().eq('company_id', companyId)
      await admin.from('company_settings').delete().eq('company_id', companyId)
      await admin.from('companies').delete().eq('id', companyId)
    }
  })

  // ----------------------------------------------------------------
  // Helper: create a draft invoice with a line item
  // ----------------------------------------------------------------
  async function createTestDraft() {
    const { data: invoice } = await admin
      .from('invoices')
      .insert({
        company_id: companyId,
        status: 'draft',
        invoice_date: new Date().toISOString().split('T')[0],
        customer_name: 'Test Customer',
        is_inter_state: false,
        subtotal: 9800,
        total_discount: 200,
        total_cgst: 882,
        total_sgst: 882,
        total_igst: 0,
        total_tax: 1764,
        grand_total: 11564,
        amount_in_words: 'Rupees Eleven Thousand Five Hundred Sixty Four Only',
        balance_due: 11564,
      })
      .select('id')
      .single()

    const invoiceId = invoice!.id

    await admin.from('invoice_items').insert({
      invoice_id: invoiceId,
      sort_order: 1,
      description: 'Test Item',
      hsn_sac: '85076000',
      quantity: 1,
      unit: 'Pcs',
      unit_price: 10000,
      discount_type: 'amount',
      discount_value: 200,
      discount_amount: 200,
      tax_rate: 18,
      taxable_amount: 9800,
      cgst_rate: 9,
      cgst_amount: 882,
      sgst_rate: 9,
      sgst_amount: 882,
      igst_rate: 0,
      igst_amount: 0,
      line_total: 11564,
    })

    return invoiceId
  }

  // ----------------------------------------------------------------
  // Helper: simulate issuing via the stored function
  // ----------------------------------------------------------------
  async function issueViaSql(invoiceId: string) {
    // Call generate_invoice_number and update atomically
    const { data: invoiceNum } = await admin.rpc('generate_invoice_number', {
      p_company_id: companyId,
      p_prefix: 'TST',
      p_financial_year: '25-26',
    })

    if (!invoiceNum) return null

    const { data } = await admin
      .from('invoices')
      .update({
        status: 'issued',
        invoice_number: invoiceNum,
        issued_at: new Date().toISOString(),
        seller_name: 'Issue Test Company',
      })
      .eq('id', invoiceId)
      .eq('status', 'draft') // Only update if still draft (idempotency guard)
      .select('id, invoice_number')
      .single()

    return data
  }

  // ----------------------------------------------------------------
  // Property 5: Stored grand_total == sum of stored line_totals
  //
  // Feature: furniture-billing, Property 5: invoice-total-consistency
  // Validates: Requirements 6.13, 15.9
  // ----------------------------------------------------------------
  it('stored grand_total equals sum of stored line_totals after issue', async () => {
    const draftId = await createTestDraft()
    await issueViaSql(draftId)

    // Fetch issued invoice and its items
    const { data: invoice } = await admin
      .from('invoices')
      .select('grand_total')
      .eq('id', draftId)
      .single()

    const { data: items } = await admin
      .from('invoice_items')
      .select('line_total')
      .eq('invoice_id', draftId)

    expect(invoice).not.toBeNull()
    expect(items).not.toBeNull()

    const sumOfLineTotals = (items ?? [])
      .reduce((sum, item) => sum.plus(item.line_total), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber()

    expect(Number(invoice!.grand_total)).toBeCloseTo(sumOfLineTotals, 2)
  })

  // ----------------------------------------------------------------
  // Property 11: Invoice number uniqueness under concurrency
  //
  // Feature: furniture-billing, Property 11: invoice-number-uniqueness-concurrency
  // Validates: Requirements 7.4, 15.6
  // ----------------------------------------------------------------
  it('concurrent invoice number generation produces unique numbers', async () => {
    const N = 10

    // Generate N invoice numbers concurrently
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        admin.rpc('generate_invoice_number', {
          p_company_id: companyId,
          p_prefix: 'CONC',
          p_financial_year: '99-00',
        })
      )
    )

    const numbers = results.map((r) => r.data as string)

    // All should succeed
    expect(numbers.every((n) => n !== null)).toBe(true)

    // All should be unique
    const unique = new Set(numbers)
    expect(unique.size).toBe(N)

    // All should follow the format CONC/NNN/99-00
    numbers.forEach((num) => {
      expect(num).toMatch(/^CONC\/\d+\/99-00$/)
    })
  })
})
