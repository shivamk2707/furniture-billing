/**
 * GET /api/pdf/[id]
 *
 * Generates and streams an A4 PDF for the requested invoice.
 * - Authenticates the request via Supabase session
 * - Verifies the invoice belongs to the user's company (RLS + explicit check)
 * - Fetches invoice + items from the database
 * - Renders using @react-pdf/renderer with the PDF invoice template
 * - Returns the PDF as a streaming download
 *
 * The invoice status is never changed by PDF generation.
 * A failure here does not affect an already-issued invoice.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { buildInvoiceData } from '@/lib/build-invoice-data'
import { InvoicePdf } from '@/components/invoice/invoice-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── Auth ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // ── Fetch invoice (RLS ensures company scoping) ────────────────
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (invoiceError || !invoice) {
    return new NextResponse('Invoice not found', { status: 404 })
  }

  // ── Fetch line items ───────────────────────────────────────────
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    return new NextResponse('Failed to load invoice items', { status: 500 })
  }

  // ── Fetch company settings ─────────────────────────────────────
  const { data: settings } = await supabase
    .from('company_settings')
    .select('legal_name, logo_url, signature_url, terms_conditions, footer_text, bank_account_holder, bank_account_number, bank_name, bank_ifsc, bank_branch, upi_id')
    .eq('company_id', invoice.company_id)
    .single()

  // ── Build InvoiceData ──────────────────────────────────────────
  let invoiceData
  try {
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`
    invoiceData = await buildInvoiceData(
      invoice,
      items ?? [],
      settings ?? null,
      'Original Copy',
      baseUrl
    )
  } catch (err) {
    console.error('Failed to build invoice data:', err)
    return new NextResponse('Failed to prepare invoice data', { status: 500 })
  }

  // ── Render PDF ─────────────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    const element = createElement(InvoicePdf, { data: invoiceData }) as ReactElement<DocumentProps>
    pdfBuffer = await renderToBuffer(element)
  } catch (err) {
    console.error('PDF rendering failed:', err)
    return new NextResponse('PDF generation failed. Please retry.', { status: 500 })
  }

  // ── Build download filename ────────────────────────────────────
  const invoiceNum = invoice.invoice_number
    ? invoice.invoice_number.replace(/\//g, '-')
    : `DRAFT-${id.slice(0, 8)}`
  const filename = `Invoice-${invoiceNum}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
