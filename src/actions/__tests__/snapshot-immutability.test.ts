/**
 * Integration test: Snapshot immutability after post-issue edits
 *
 * Property 6: For any issued invoice, after updating the corresponding
 * customer's name/address OR the product's price/tax rate:
 * - The customer_name, customer_billing_addr columns on invoices SHALL remain unchanged
 * - The unit_price, tax_rate, line_total columns on invoice_items SHALL remain unchanged
 *
 * Requires SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY.
 * Skips gracefully when not configured.
 *
 * Feature: furniture-billing, Property 6: snapshot-immutability-after-post-issue-edits
 * Validates: Requirements 3.8, 4.7
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const TEST_URL = process.env.SUPABASE_TEST_URL
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const hasTestDb = Boolean(TEST_URL && TEST_SERVICE_KEY)

let companyId: string
let customerId: string
let productId: string
let invoiceId: string

describe.skipIf(!hasTestDb)('Snapshot immutability (Property 6)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: SupabaseClient<any>

  beforeAll(async () => {
    admin = createClient(TEST_URL!, TEST_SERVICE_KEY!)

    // Create test company
    const { data: company } = await admin
      .from('companies')
      .insert({ name: 'Snapshot Test Company' })
      .select('id')
      .single()
    companyId = company!.id

    await admin.from('company_settings').insert({
      company_id: companyId,
      legal_name: 'Snapshot Test Company',
      invoice_prefix: 'SNAP',
      state_code: '09',
      due_date_offset_days: 15,
    })

    // Create a customer
    const { data: customer } = await admin
      .from('customers')
      .insert({
        company_id: companyId,
        name: 'Original Customer Name',
        mobile: '9876543210',
        billing_address: 'Original Address, City - 000001',
      })
      .select('id')
      .single()
    customerId = customer!.id

    // Create a product
    const { data: product } = await admin
      .from('products')
      .insert({
        company_id: companyId,
        name: 'Test Product',
        sku: 'SNAP-001',
        selling_price: 10000.00,
        tax_rate: 18.00,
        unit: 'Pcs',
      })
      .select('id')
      .single()
    productId = product!.id

    // Create and issue an invoice
    const { data: invoice } = await admin
      .from('invoices')
      .insert({
        company_id: companyId,
        status: 'draft',
        invoice_date: new Date().toISOString().split('T')[0],
        customer_id: customerId,
        customer_name: 'Original Customer Name',
        customer_billing_addr: 'Original Address, City - 000001',
        is_inter_state: false,
        seller_name: 'Snapshot Test Company',
        subtotal: 9800,
        total_cgst: 882,
        total_sgst: 882,
        total_tax: 1764,
        grand_total: 11564,
        amount_in_words: 'Rupees Eleven Thousand Five Hundred Sixty Four Only',
        balance_due: 11564,
      })
      .select('id')
      .single()
    invoiceId = invoice!.id

    // Add a line item with the original product price
    await admin.from('invoice_items').insert({
      invoice_id: invoiceId,
      sort_order: 1,
      product_id: productId,
      description: 'Test Product',
      quantity: 1,
      unit: 'Pcs',
      unit_price: 10000.00,
      tax_rate: 18.00,
      taxable_amount: 9800,
      cgst_rate: 9,
      cgst_amount: 882,
      sgst_rate: 9,
      sgst_amount: 882,
      igst_rate: 0,
      igst_amount: 0,
      line_total: 11564,
      discount_type: 'amount',
      discount_value: 200,
      discount_amount: 200,
    })

    // Issue the invoice
    const { data: invoiceNum } = await admin.rpc('generate_invoice_number', {
      p_company_id: companyId,
      p_prefix: 'SNAP',
      p_financial_year: '25-26',
    })

    await admin
      .from('invoices')
      .update({
        status: 'issued',
        invoice_number: invoiceNum,
        issued_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
  })

  afterAll(async () => {
    if (invoiceId) {
      await admin.from('invoice_items').delete().eq('invoice_id', invoiceId)
      await admin.from('invoices').delete().eq('id', invoiceId)
    }
    if (productId) await admin.from('products').delete().eq('id', productId)
    if (customerId) await admin.from('customers').delete().eq('id', customerId)
    if (companyId) {
      await admin.from('invoice_counters').delete().eq('company_id', companyId)
      await admin.from('company_settings').delete().eq('company_id', companyId)
      await admin.from('companies').delete().eq('id', companyId)
    }
  })

  it('invoice customer snapshot is unchanged after customer record is updated', async () => {
    // Update the live customer record
    await admin
      .from('customers')
      .update({
        name: 'UPDATED Customer Name',
        billing_address: 'UPDATED Address, New City - 999999',
      })
      .eq('id', customerId)

    // Re-fetch the issued invoice — snapshot must be original
    const { data: invoice } = await admin
      .from('invoices')
      .select('customer_name, customer_billing_addr')
      .eq('id', invoiceId)
      .single()

    expect(invoice!.customer_name).toBe('Original Customer Name')
    expect(invoice!.customer_billing_addr).toBe('Original Address, City - 000001')
  })

  it('invoice line item snapshot is unchanged after product price is updated', async () => {
    // Update the live product record
    await admin
      .from('products')
      .update({
        selling_price: 99999.00,
        tax_rate: 28.00,
      })
      .eq('id', productId)

    // Re-fetch the invoice items — snapshot must be original
    const { data: items } = await admin
      .from('invoice_items')
      .select('unit_price, tax_rate, line_total')
      .eq('invoice_id', invoiceId)

    expect(items).toHaveLength(1)
    expect(Number(items![0].unit_price)).toBe(10000)
    expect(Number(items![0].tax_rate)).toBe(18)
    expect(Number(items![0].line_total)).toBe(11564)
  })
})
