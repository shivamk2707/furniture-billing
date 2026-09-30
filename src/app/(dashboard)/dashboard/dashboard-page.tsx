import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/auth/require-role'
import { getFinancialYear } from '@/lib/calculation-engine'
import { formatDate } from '@/lib/invoice-types'
import { redirect } from 'next/navigation'

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

async function getDashboardData(companyId: string) {
  const supabase = await createClient()
  const fy = getFinancialYear(new Date())
  const [fyStart] = fy.split('-')
  const startYear = 2000 + Number(fyStart)
  const fyStartDate = `${startYear}-04-01`
  const fyEndDate = `${startYear + 1}-03-31`

  // KPI aggregates — exclude voided invoices
  const { data: agg } = await supabase
    .from('invoices')
    .select('grand_total, total_tax, amount_paid, balance_due')
    .eq('company_id', companyId)
    .eq('status', 'issued')
    .gte('invoice_date', fyStartDate)
    .lte('invoice_date', fyEndDate)

  const invoices = agg ?? []
  const totalSales = invoices.reduce((s, i) => s + Number(i.grand_total), 0)
  const invoiceCount = invoices.length
  const totalTax = invoices.reduce((s, i) => s + Number(i.total_tax), 0)
  const amountReceived = invoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  const outstanding = invoices.reduce((s, i) => s + Number(i.balance_due), 0)

  // Recent invoices
  const { data: recent } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, customer_name, grand_total, payment_status, status')
    .eq('company_id', companyId)
    .eq('status', 'issued')
    .order('issued_at', { ascending: false })
    .limit(5)

  return { totalSales, invoiceCount, totalTax, amountReceived, outstanding, recent: recent ?? [], fy }
}

export async function DashboardPage() {
  const auth = await getActiveCompany()
  if (!auth) redirect('/login')

  const { totalSales, invoiceCount, totalTax, amountReceived, outstanding, recent, fy } =
    await getDashboardData(auth.companyId)

  const kpis = [
    { label: 'Total Sales', value: formatINR(totalSales), sub: `FY ${fy}`, color: 'blue' },
    { label: 'Invoices Issued', value: invoiceCount.toString(), sub: `FY ${fy}`, color: 'indigo' },
    { label: 'Tax Collected', value: formatINR(totalTax), sub: 'CGST + SGST + IGST', color: 'purple' },
    { label: 'Amount Received', value: formatINR(amountReceived), sub: 'Payments recorded', color: 'green' },
    { label: 'Outstanding', value: formatINR(outstanding), sub: 'Balance due', color: 'orange' },
  ]

  const PAYMENT_COLOR: Record<string, string> = {
    unpaid: 'text-orange-600',
    partially_paid: 'text-yellow-600',
    paid: 'text-green-600',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/invoices/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent Invoices</h2>
          <Link href="/invoices" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 text-center">No invoices yet. Create your first invoice.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Invoice #</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-left">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline font-medium">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{formatDate(inv.invoice_date)}</td>
                  <td className="px-5 py-3 text-gray-700">{inv.customer_name ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-gray-900">{formatINR(Number(inv.grand_total))}</td>
                  <td className={`px-5 py-3 text-xs font-medium capitalize ${PAYMENT_COLOR[inv.payment_status] ?? ''}`}>
                    {inv.payment_status.replace('_', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
