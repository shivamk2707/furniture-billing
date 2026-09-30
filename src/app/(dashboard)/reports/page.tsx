import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/auth/require-role'
import { redirect } from 'next/navigation'
import { ReportsClient } from './reports-client'
import { getFinancialYear } from '@/lib/calculation-engine'

async function getDatewiseReport(companyId: string, dateFrom: string, dateTo: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('invoices')
    .select('invoice_date, subtotal, total_cgst, total_sgst, total_igst, total_tax, grand_total')
    .eq('company_id', companyId)
    .eq('status', 'issued')
    .gte('invoice_date', dateFrom)
    .lte('invoice_date', dateTo)
    .order('invoice_date', { ascending: true })

  if (!data) return []

  // Group by date
  const byDate = new Map<string, {
    date: string; count: number; taxable: number; cgst: number; sgst: number; igst: number; gross: number
  }>()

  for (const inv of data) {
    const date = inv.invoice_date ?? 'Unknown'
    const existing = byDate.get(date) ?? { date, count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gross: 0 }
    byDate.set(date, {
      date,
      count: existing.count + 1,
      taxable: existing.taxable + Number(inv.subtotal),
      cgst: existing.cgst + Number(inv.total_cgst),
      sgst: existing.sgst + Number(inv.total_sgst),
      igst: existing.igst + Number(inv.total_igst),
      gross: existing.gross + Number(inv.grand_total),
    })
  }

  return Array.from(byDate.values())
}

async function getCustomerwiseReport(companyId: string, dateFrom: string, dateTo: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('invoices')
    .select('customer_name, subtotal, total_tax, grand_total')
    .eq('company_id', companyId)
    .eq('status', 'issued')
    .gte('invoice_date', dateFrom)
    .lte('invoice_date', dateTo)

  if (!data) return []

  const byCustomer = new Map<string, {
    name: string; count: number; taxable: number; tax: number; gross: number
  }>()

  for (const inv of data) {
    const name = inv.customer_name ?? 'Unknown'
    const existing = byCustomer.get(name) ?? { name, count: 0, taxable: 0, tax: 0, gross: 0 }
    byCustomer.set(name, {
      name,
      count: existing.count + 1,
      taxable: existing.taxable + Number(inv.subtotal),
      tax: existing.tax + Number(inv.total_tax),
      gross: existing.gross + Number(inv.grand_total),
    })
  }

  return Array.from(byCustomer.values()).sort((a, b) => b.gross - a.gross)
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>
}) {
  const auth = await getActiveCompany()
  if (!auth) redirect('/login')

  const params = await searchParams
  const fy = getFinancialYear(new Date())
  const [fyStart] = fy.split('-')
  const startYear = 2000 + Number(fyStart)

  const dateFrom = params.from ?? `${startYear}-04-01`
  const dateTo = params.to ?? `${startYear + 1}-03-31`
  const tab = params.tab ?? 'date'

  const [datewise, customerwise] = await Promise.all([
    getDatewiseReport(auth.companyId, dateFrom, dateTo),
    getCustomerwiseReport(auth.companyId, dateFrom, dateTo),
  ])

  return (
    <div className="p-8">
      <ReportsClient
        dateFrom={dateFrom}
        dateTo={dateTo}
        tab={tab}
        datewiseData={datewise}
        customerwiseData={customerwise}
      />
    </div>
  )
}
