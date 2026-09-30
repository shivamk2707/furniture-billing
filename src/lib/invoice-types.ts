/**
 * Shared invoice data types used by:
 * - InvoiceTemplate (browser preview)
 * - PDF generation (@react-pdf/renderer)
 * - Server Actions (issueInvoice)
 */

export interface InvoiceLineItem {
  sort_order: number
  description: string
  hsn_sac: string | null
  quantity: number
  unit: string | null
  unit_price: number
  discount_type: 'amount' | 'percent' | null
  discount_value: number
  discount_amount: number
  tax_rate: number
  taxable_amount: number
  cgst_rate: number
  cgst_amount: number
  sgst_rate: number
  sgst_amount: number
  igst_rate: number
  igst_amount: number
  line_total: number
}

export interface InvoiceData {
  // Page meta
  page_number: number
  total_pages: number
  copy_label: string // "Original Copy" | "Duplicate Copy"

  // Invoice header
  invoice_number: string | null
  status: 'draft' | 'issued' | 'void'
  invoice_date: string | null
  due_date: string | null
  place_of_supply: string | null
  is_inter_state: boolean
  reverse_charge: boolean

  // Seller (company snapshot)
  seller_name: string | null
  seller_address: string | null
  seller_mobile: string | null
  seller_email: string | null
  seller_gstin: string | null
  seller_pan: string | null
  seller_logo_url: string | null

  // Buyer (customer snapshot)
  customer_name: string | null
  customer_gstin: string | null
  customer_mobile: string | null
  customer_email: string | null
  customer_billing_addr: string | null
  customer_shipping_addr: string | null

  // Transport
  transporter_name: string | null
  vehicle_number: string | null
  transport_doc_number: string | null
  transport_doc_date: string | null
  eway_bill_number: string | null
  eway_bill_date: string | null

  // E-invoice
  irn: string | null
  ack_number: string | null
  ack_date: string | null

  // Line items
  line_items: InvoiceLineItem[]

  // Totals
  subtotal: number
  total_discount: number
  total_cgst: number
  total_sgst: number
  total_igst: number
  total_tax: number
  round_off: number
  grand_total: number
  amount_in_words: string

  // Payment
  amount_paid: number
  balance_due: number

  // Footer
  terms_conditions: string | null
  footer_text: string | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_name: string | null
  bank_ifsc: string | null
  bank_branch: string | null
  bank_qr_data: string | null   // UPI payment deep link
  einvoice_qr_data: string | null
  signature_url: string | null
}

/** Format a number in Indian currency notation (₹1,23,456.78) */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Format a number as plain Indian notation (1,23,456.78) */
export function formatNumber(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/** Format a date string (YYYY-MM-DD) → DD-Mon-YY */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}
