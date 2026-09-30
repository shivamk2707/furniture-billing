import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/auth/require-role'
import { buildInvoiceData } from '@/lib/build-invoice-data'
import { InvoiceTemplate } from '@/components/invoice/invoice-template'
import { InvoiceDetailActions } from './invoice-detail-actions'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const auth = await getActiveCompany()
  if (!auth) notFound()

  const supabase = await createClient()

  // Fetch invoice (RLS enforces company scoping)
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (!invoice) notFound()

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order')

  const { data: settings } = await supabase
    .from('company_settings')
    .select('legal_name, logo_url, signature_url, terms_conditions, footer_text, bank_account_holder, bank_account_number, bank_name, bank_ifsc, bank_branch, upi_id')
    .eq('company_id', invoice.company_id)
    .single()

  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${host}`

  const invoiceData = await buildInvoiceData(invoice, items ?? [], settings ?? null, 'Original Copy', baseUrl)

  return (
    <div className="p-8 max-w-5xl">
      {/* Action bar */}
      <InvoiceDetailActions
        invoiceId={id}
        status={invoice.status}
        invoiceNumber={invoice.invoice_number}
        role={auth.role}
        balanceDue={Number(invoice.balance_due)}
      />

      {/* Invoice preview */}
      <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
        <InvoiceTemplate data={invoiceData} />
      </div>
    </div>
  )
}
