/**
 * Builds an InvoiceData object from a Supabase invoice + items database record.
 * Used by both the PDF route handler and the invoice editor preview.
 */

import type { InvoiceData, InvoiceLineItem } from './invoice-types'
import { generateUpiQrCode, generateQrCode } from './qr-code'

// Raw database row types (matches the invoices + invoice_items schema)
export interface DbInvoice {
  id: string
  invoice_number: string | null
  status: 'draft' | 'issued' | 'void'
  invoice_date: string | null
  due_date: string | null
  place_of_supply: string | null
  is_inter_state: boolean | null
  reverse_charge: boolean
  customer_name: string | null
  customer_gstin: string | null
  customer_pan: string | null
  customer_mobile: string | null
  customer_email: string | null
  customer_billing_addr: string | null
  customer_shipping_addr: string | null
  seller_name: string | null
  seller_gstin: string | null
  seller_address: string | null
  seller_mobile: string | null
  seller_email: string | null
  seller_pan: string | null
  transporter_name: string | null
  vehicle_number: string | null
  transport_doc_number: string | null
  transport_doc_date: string | null
  eway_bill_number: string | null
  eway_bill_date: string | null
  irn: string | null
  ack_number: string | null
  ack_date: string | null
  subtotal: number
  total_discount: number
  total_cgst: number
  total_sgst: number
  total_igst: number
  total_tax: number
  round_off: number
  grand_total: number
  amount_in_words: string | null
  amount_paid: number
  balance_due: number
}

export interface DbInvoiceItem {
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

export interface DbCompanySettings {
  legal_name: string | null
  logo_url: string | null
  signature_url: string | null
  terms_conditions: string | null
  footer_text: string | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_name: string | null
  bank_ifsc: string | null
  bank_branch: string | null
  upi_id: string | null
}

export async function buildInvoiceData(
  invoice: DbInvoice,
  items: DbInvoiceItem[],
  settings: DbCompanySettings | null,
  copyLabel = 'Original Copy',
  baseUrl?: string
): Promise<InvoiceData> {
  // Generate bank QR code if UPI ID is configured
  let bankQrData: string | null = null
  if (settings?.upi_id) {
    try {
      bankQrData = await generateUpiQrCode(
        settings.upi_id,
        settings.bank_account_holder ?? invoice.seller_name ?? 'Payee',
        invoice.grand_total
      )
    } catch {
      // QR generation is non-critical; continue without it
    }
  }

  // Generate E-Invoice QR code if a baseUrl is provided
  let einvoiceQrData: string | null = null
  if (baseUrl && invoice.status === 'issued') {
    try {
      einvoiceQrData = await generateQrCode(`${baseUrl}/invoices/${invoice.id}`)
    } catch {
      // QR generation is non-critical
    }
  }

  const lineItems: InvoiceLineItem[] = [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      sort_order: item.sort_order,
      description: item.description,
      hsn_sac: item.hsn_sac,
      quantity: Number(item.quantity),
      unit: item.unit,
      unit_price: Number(item.unit_price),
      discount_type: item.discount_type,
      discount_value: Number(item.discount_value),
      discount_amount: Number(item.discount_amount),
      tax_rate: Number(item.tax_rate),
      taxable_amount: Number(item.taxable_amount),
      cgst_rate: Number(item.cgst_rate),
      cgst_amount: Number(item.cgst_amount),
      sgst_rate: Number(item.sgst_rate),
      sgst_amount: Number(item.sgst_amount),
      igst_rate: Number(item.igst_rate),
      igst_amount: Number(item.igst_amount),
      line_total: Number(item.line_total),
    }))

  return {
    page_number: 1,
    total_pages: 1, // will be recalculated by paginateInvoice
    copy_label: copyLabel,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    place_of_supply: invoice.place_of_supply,
    is_inter_state: invoice.is_inter_state ?? false,
    reverse_charge: invoice.reverse_charge,
    seller_name: invoice.seller_name,
    seller_address: invoice.seller_address,
    seller_mobile: invoice.seller_mobile,
    seller_email: invoice.seller_email,
    seller_gstin: invoice.seller_gstin,
    seller_pan: invoice.seller_pan,
    seller_logo_url: settings?.logo_url ?? null,
    customer_name: invoice.customer_name,
    customer_gstin: invoice.customer_gstin,
    customer_mobile: invoice.customer_mobile,
    customer_email: invoice.customer_email,
    customer_billing_addr: invoice.customer_billing_addr,
    customer_shipping_addr: invoice.customer_shipping_addr,
    transporter_name: invoice.transporter_name,
    vehicle_number: invoice.vehicle_number,
    transport_doc_number: invoice.transport_doc_number,
    transport_doc_date: invoice.transport_doc_date,
    eway_bill_number: invoice.eway_bill_number,
    eway_bill_date: invoice.eway_bill_date,
    irn: invoice.irn,
    ack_number: invoice.ack_number,
    ack_date: invoice.ack_date,
    line_items: lineItems,
    subtotal: Number(invoice.subtotal),
    total_discount: Number(invoice.total_discount),
    total_cgst: Number(invoice.total_cgst),
    total_sgst: Number(invoice.total_sgst),
    total_igst: Number(invoice.total_igst),
    total_tax: Number(invoice.total_tax),
    round_off: Number(invoice.round_off),
    grand_total: Number(invoice.grand_total),
    amount_in_words: invoice.amount_in_words ?? '',
    amount_paid: Number(invoice.amount_paid),
    balance_due: Number(invoice.balance_due),
    terms_conditions: settings?.terms_conditions ?? null,
    footer_text: settings?.footer_text ?? null,
    bank_account_holder: settings?.bank_account_holder ?? null,
    bank_account_number: settings?.bank_account_number ?? null,
    bank_name: settings?.bank_name ?? null,
    bank_ifsc: settings?.bank_ifsc ?? null,
    bank_branch: settings?.bank_branch ?? null,
    bank_qr_data: bankQrData,
    einvoice_qr_data: einvoiceQrData,
    signature_url: settings?.signature_url ?? null,
  }
}
