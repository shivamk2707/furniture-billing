/**
 * PDF generation test
 *
 * Validates: Requirements 9.1, 9.2, 9.7
 *
 * NOTE: @react-pdf/renderer v3 bundles its own React reconciler.
 * When Vitest loads both React 19 (from node_modules) and the bundled
 * reconciler simultaneously, a conflict occurs.
 *
 * The PDF generation is tested end-to-end via the API route in E2E tests.
 * This unit test validates the PDF template structure and data building.
 */

import { describe, it, expect } from 'vitest'
import { InvoicePdf } from '../invoice-pdf'
import { buildInvoiceData } from '@/lib/build-invoice-data'
import type { DbInvoice, DbInvoiceItem } from '@/lib/build-invoice-data'

// Sample DB invoice record
const dbInvoice: DbInvoice = {
  id: 'test-id',
  invoice_number: 'PP/001/25-26',
  status: 'issued',
  invoice_date: '2025-04-22',
  due_date: '2025-05-07',
  place_of_supply: '09 - Uttar Pradesh',
  is_inter_state: false,
  reverse_charge: false,
  customer_name: 'Ramesh Kumar',
  customer_gstin: null,
  customer_pan: null,
  customer_mobile: '9876543210',
  customer_email: null,
  customer_billing_addr: '45, Gandhi Nagar, Lucknow, UP - 226002',
  customer_shipping_addr: null,
  seller_name: 'Prakash Furniture Pvt. Ltd.',
  seller_gstin: '09AAACP1234A1Z5',
  seller_address: '123, Furniture Market, Lucknow - 226001',
  seller_mobile: '+91 98765 43210',
  seller_email: 'billing@prakashfurniture.com',
  seller_pan: 'AAACP1234A',
  transporter_name: null, vehicle_number: null, transport_doc_number: null,
  transport_doc_date: null, eway_bill_number: null, eway_bill_date: null,
  irn: null, ack_number: null, ack_date: null,
  subtotal: 9800,
  total_discount: 200,
  total_cgst: 882,
  total_sgst: 882,
  total_igst: 0,
  total_tax: 1764,
  round_off: 0,
  grand_total: 11564,
  amount_in_words: 'Rupees Eleven Thousand Five Hundred Sixty Four Only',
  amount_paid: 0,
  balance_due: 11564,
}

const dbItem: DbInvoiceItem = {
  sort_order: 1,
  description: 'Item Description 1',
  hsn_sac: '85076000',
  quantity: 1,
  unit: 'Box',
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
}

describe('Invoice PDF data building (Requirements 9.1, 9.2, 9.7)', () => {
  it('InvoicePdf component is defined and importable', () => {
    expect(InvoicePdf).toBeDefined()
    expect(typeof InvoicePdf).toBe('function')
  })

  it('buildInvoiceData produces valid InvoiceData from DB records', async () => {
    const data = await buildInvoiceData(dbInvoice, [dbItem], null)

    expect(data.invoice_number).toBe('PP/001/25-26')
    expect(data.seller_name).toBe('Prakash Furniture Pvt. Ltd.')
    expect(data.customer_name).toBe('Ramesh Kumar')
    expect(data.grand_total).toBe(11564)
    expect(data.line_items).toHaveLength(1)
    expect(data.line_items[0].description).toBe('Item Description 1')
    expect(data.line_items[0].line_total).toBe(11564)
    expect(data.is_inter_state).toBe(false)
    expect(data.status).toBe('issued')
  })

  it('buildInvoiceData populates company settings when provided', async () => {
    const settings = {
      legal_name: 'Prakash Furniture Pvt. Ltd.',
      logo_url: null,
      signature_url: null,
      terms_conditions: '1. Payment due in 15 days.',
      footer_text: 'Computer generated invoice.',
      bank_account_holder: 'Prakash Furniture',
      bank_account_number: '1234567890',
      bank_name: 'SBI',
      bank_ifsc: 'SBIN0001234',
      bank_branch: 'Lucknow',
      upi_id: null, // no UPI = no QR
    }
    const data = await buildInvoiceData(dbInvoice, [dbItem], settings)

    expect(data.terms_conditions).toBe('1. Payment due in 15 days.')
    expect(data.bank_account_number).toBe('1234567890')
    expect(data.bank_name).toBe('SBI')
    expect(data.bank_qr_data).toBeNull() // no UPI configured
  })

  it('line items are sorted by sort_order', async () => {
    const items: DbInvoiceItem[] = [
      { ...dbItem, sort_order: 3, description: 'Third' },
      { ...dbItem, sort_order: 1, description: 'First' },
      { ...dbItem, sort_order: 2, description: 'Second' },
    ]
    const data = await buildInvoiceData(dbInvoice, items, null)

    expect(data.line_items[0].description).toBe('First')
    expect(data.line_items[1].description).toBe('Second')
    expect(data.line_items[2].description).toBe('Third')
  })

  it('copy_label defaults to "Original Copy"', async () => {
    const data = await buildInvoiceData(dbInvoice, [dbItem], null)
    expect(data.copy_label).toBe('Original Copy')
  })
})
