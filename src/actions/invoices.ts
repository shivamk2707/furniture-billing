'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { draftInvoiceSchema } from '@/lib/validations/invoice'
import { calculateInvoice, getFinancialYear, amountToWords } from '@/lib/calculation-engine'
import type { ActionResult } from '@/lib/types'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface InvoiceSummary {
  id: string
  invoice_number: string | null
  status: 'draft' | 'issued' | 'void'
  invoice_date: string | null
  due_date: string | null
  customer_name: string | null
  customer_mobile: string | null
  grand_total: number
  amount_paid: number
  balance_due: number
  payment_status: string
  created_at: string
}

// ----------------------------------------------------------------
// Read
// ----------------------------------------------------------------

export async function getInvoices(options?: {
  search?: string
  status?: string
  paymentStatus?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}): Promise<{ invoices: InvoiceSummary[]; total: number }> {
  const supabase = await createClient()
  const { companyId } = await requireRole(['admin', 'billing_staff', 'viewer'])

  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, status, invoice_date, due_date, customer_name, customer_mobile, grand_total, amount_paid, balance_due, payment_status, created_at', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (options?.search?.trim()) {
    query = query.or(
      `invoice_number.ilike.%${options.search}%,customer_name.ilike.%${options.search}%,customer_mobile.ilike.%${options.search}%`
    )
  }
  if (options?.status) query = query.eq('status', options.status)
  if (options?.paymentStatus) query = query.eq('payment_status', options.paymentStatus)
  if (options?.dateFrom) query = query.gte('invoice_date', options.dateFrom)
  if (options?.dateTo) query = query.lte('invoice_date', options.dateTo)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  return { invoices: (data ?? []) as InvoiceSummary[], total: count ?? 0 }
}

export async function getDraftInvoice(invoiceId: string) {
  const supabase = await createClient()
  const { companyId } = await requireRole(['admin', 'billing_staff'])

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .single()

  if (!invoice) return null

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order')

  return { invoice, items: items ?? [] }
}

// ----------------------------------------------------------------
// Save Draft
// ----------------------------------------------------------------

export async function saveDraftInvoice(
  formData: unknown,
  invoiceId?: string
): Promise<ActionResult<{ id: string }>> {
  const { companyId } = await requireRole(['admin', 'billing_staff'])

  const parsed = draftInvoiceSchema.safeParse(formData)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const { line_items, ...headerFields } = parsed.data
  const supabase = await createClient()

  // Determine is_inter_state from company state vs place of supply
  const { data: settings } = await supabase
    .from('company_settings')
    .select('state_code')
    .eq('company_id', companyId)
    .single()

  const companyStateCode = settings?.state_code ?? null
  const placeOfSupply = headerFields.place_of_supply
  const isInterState = companyStateCode && placeOfSupply
    ? companyStateCode !== placeOfSupply.split(' ')[0]
    : false

  // Calculate totals from line items
  let calcResult = null
  if (line_items.length > 0) {
    calcResult = calculateInvoice(
      line_items.map((li) => ({
        quantity: li.quantity,
        unitPrice: li.unit_price,
        discountType: li.discount_type,
        discountValue: li.discount_value,
        taxRate: li.tax_rate,
      })),
      isInterState
    )
  }

  const invoiceData = {
    company_id: companyId,
    status: 'draft' as const,
    is_inter_state: isInterState,
    ...headerFields,
    subtotal: calcResult?.subtotal ?? 0,
    total_discount: calcResult?.totalDiscount ?? 0,
    total_cgst: calcResult?.totalCgst ?? 0,
    total_sgst: calcResult?.totalSgst ?? 0,
    total_igst: calcResult?.totalIgst ?? 0,
    total_tax: calcResult?.totalTax ?? 0,
    grand_total: calcResult?.grandTotal ?? 0,
    amount_in_words: calcResult ? amountToWords(calcResult.grandTotal) : '',
    balance_due: calcResult?.grandTotal ?? 0,
    updated_at: new Date().toISOString(),
  }

  let savedInvoiceId: string

  if (invoiceId) {
    // Update existing draft (only if it's still a draft)
    const { data, error } = await supabase
      .from('invoices')
      .update(invoiceData)
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .eq('status', 'draft')
      .select('id')
      .single()

    if (error || !data) {
      return { success: false, error: error?.message ?? 'Invoice not found or already issued' }
    }
    savedInvoiceId = data.id
  } else {
    // Create new draft
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select('id')
      .single()

    if (error || !data) {
      return { success: false, error: error?.message ?? 'Failed to create draft' }
    }
    savedInvoiceId = data.id
  }

  // Upsert line items
  if (line_items.length > 0 && calcResult) {
    // Delete existing items and reinsert (simplest correct approach for drafts)
    await supabase.from('invoice_items').delete().eq('invoice_id', savedInvoiceId)

    const itemRows = line_items.map((li, idx) => {
      const calc = calcResult!.lineItems[idx]
      return {
        invoice_id: savedInvoiceId,
        sort_order: idx + 1,
        product_id: li.product_id ?? null,
        description: li.description,
        hsn_sac: li.hsn_sac ?? null,
        quantity: li.quantity,
        unit: li.unit ?? 'Pcs',
        unit_price: li.unit_price,
        discount_type: li.discount_type,
        discount_value: li.discount_value,
        discount_amount: calc.discountAmount,
        tax_rate: li.tax_rate,
        taxable_amount: calc.taxableAmount,
        cgst_rate: calc.cgstRate,
        cgst_amount: calc.cgstAmount,
        sgst_rate: calc.sgstRate,
        sgst_amount: calc.sgstAmount,
        igst_rate: calc.igstRate,
        igst_amount: calc.igstAmount,
        line_total: calc.lineTotal,
      }
    })

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)
    if (itemsError) {
      return { success: false, error: itemsError.message }
    }
  } else if (line_items.length === 0) {
    // Clear all items if list is empty
    await supabase.from('invoice_items').delete().eq('invoice_id', savedInvoiceId)
  }

  revalidatePath('/invoices')
  return { success: true, data: { id: savedInvoiceId } }
}

// ----------------------------------------------------------------
// Issue Invoice (stub — full implementation in Task 11)
// ----------------------------------------------------------------

export async function issueInvoice(invoiceId: string): Promise<ActionResult<{ invoice_number: string }>> {
  const { companyId } = await requireRole(['admin', 'billing_staff'])
  const supabase = await createClient()

  // Fetch draft to validate
  const { data: draft } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .single()

  if (!draft) return { success: false, error: 'Invoice not found' }
  if (draft.status !== 'draft') return { success: false, error: 'Invoice is not a draft' }
  if (!draft.invoice_items?.length) return { success: false, error: 'Invoice has no line items' }
  if (!draft.invoice_date) return { success: false, error: 'Invoice date is required' }
  if (!draft.customer_name) return { success: false, error: 'Customer is required' }

  // Get company settings for invoice prefix and seller snapshot
  const { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()

  const prefix = settings?.invoice_prefix ?? 'INV'
  const financialYear = getFinancialYear(new Date(draft.invoice_date))

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Re-calculate totals server-side from stored line items
  const calcResult = calculateInvoice(
    draft.invoice_items.map((li: Record<string, unknown>) => ({
      quantity: Number(li.quantity),
      unitPrice: Number(li.unit_price),
      discountType: (li.discount_type as 'amount' | 'percent') ?? 'amount',
      discountValue: Number(li.discount_value),
      taxRate: Number(li.tax_rate),
    })),
    draft.is_inter_state ?? false
  )

  // Generate invoice number atomically via stored function
  const { data: invoiceNumber, error: numError } = await supabase.rpc(
    'generate_invoice_number',
    { p_company_id: companyId, p_prefix: prefix, p_financial_year: financialYear }
  )

  if (numError || !invoiceNumber) {
    return { success: false, error: numError?.message ?? 'Failed to generate invoice number' }
  }

  const now = new Date().toISOString()

  // Update invoice to issued status with snapshots
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'issued',
      invoice_number: invoiceNumber,
      issued_at: now,
      issued_by: user?.id ?? null,
      // Seller snapshot from company settings
      seller_name: settings?.legal_name ?? settings?.display_name ?? null,
      seller_gstin: settings?.gstin ?? null,
      seller_address: settings?.address ?? null,
      seller_mobile: settings?.mobile ?? null,
      seller_email: settings?.email ?? null,
      seller_pan: settings?.pan ?? null,
      seller_state_code: settings?.state_code ?? null,
      // Re-calculated totals (server-authoritative)
      subtotal: calcResult.subtotal,
      total_discount: calcResult.totalDiscount,
      total_cgst: calcResult.totalCgst,
      total_sgst: calcResult.totalSgst,
      total_igst: calcResult.totalIgst,
      total_tax: calcResult.totalTax,
      grand_total: calcResult.grandTotal,
      amount_in_words: amountToWords(calcResult.grandTotal),
      balance_due: calcResult.grandTotal - Number(draft.amount_paid ?? 0),
      updated_at: now,
    })
    .eq('id', invoiceId)
    .eq('company_id', companyId)

  if (updateError) return { success: false, error: updateError.message }

  // Update line items with re-calculated values (snapshot)
  for (let idx = 0; idx < draft.invoice_items.length; idx++) {
    const li = draft.invoice_items[idx] as Record<string, unknown>
    const calc = calcResult.lineItems[idx]
    await supabase
      .from('invoice_items')
      .update({
        discount_amount: calc.discountAmount,
        taxable_amount: calc.taxableAmount,
        cgst_rate: calc.cgstRate,
        cgst_amount: calc.cgstAmount,
        sgst_rate: calc.sgstRate,
        sgst_amount: calc.sgstAmount,
        igst_rate: calc.igstRate,
        igst_amount: calc.igstAmount,
        line_total: calc.lineTotal,
      })
      .eq('id', li.id as string)
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: user?.id ?? null,
    action: 'invoice.issued',
    entity_type: 'invoice',
    entity_id: invoiceId,
    metadata: { invoice_number: invoiceNumber, grand_total: calcResult.grandTotal },
  })

  revalidatePath('/invoices')
  return { success: true, data: { invoice_number: invoiceNumber } }
}

// ----------------------------------------------------------------
// Void Invoice
// ----------------------------------------------------------------

export async function voidInvoice(
  invoiceId: string,
  reason: string
): Promise<ActionResult> {
  const { companyId, userId } = await requireRole(['admin'])
  const supabase = await createClient()

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'void',
      void_at: now,
      void_by: userId,
      void_reason: reason,
      updated_at: now,
    })
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .eq('status', 'issued')

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: userId,
    action: 'invoice.voided',
    entity_type: 'invoice',
    entity_id: invoiceId,
    metadata: { reason },
  })

  revalidatePath('/invoices')
  return { success: true }
}

// ----------------------------------------------------------------
// Delete Invoice
// ----------------------------------------------------------------

export async function deleteInvoice(invoiceId: string): Promise<ActionResult> {
  const { companyId, userId } = await requireRole(['admin'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('company_id', companyId)

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: userId,
    action: 'invoice.deleted',
    entity_type: 'invoice',
    entity_id: invoiceId,
    metadata: { reason: 'Deleted by admin' },
  })

  revalidatePath('/invoices')
  return { success: true }
}
